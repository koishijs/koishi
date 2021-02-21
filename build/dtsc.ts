import { spawnAsync, getWorkspaces, cwd } from './utils'
import { resolve } from 'path'
import * as fs from 'fs-extra'
import globby from 'globby'
import json from 'json5'
import cac from 'cac'

const { args } = cac().parse()

const prefixes = ['packages/', 'packages/koishi-', 'packages/adapter-', 'packages/plugin-']

getWorkspaces().then(async (folders) => {
  if (args.length) {
    for (const name of args) {
      await build(folders.find(folder => {
        return folder.endsWith(name) && prefixes.includes(folder.slice(0, -name.length))
      }))
    }
  } else {
    const config = await fs.readFile(resolve(cwd, 'tsconfig.json'), 'utf8')
    const { references } = json.parse(config)
    for (const { path } of references) {
      await build(path)
    }
  }

  async function build(path: string) {
    const fullpath = resolve(cwd, path)
    const srcpath = fullpath + '/src'

    const [files, code, config] = await Promise.all([
      globby(srcpath),
      spawnAsync(['tsc', '-b', path]),
      fs.readFile(fullpath + '/tsconfig.json', 'utf8'),
    ])
    if (code) process.exit(code)

    if (!json.parse(config).compilerOptions.outFile) return
    const entry = fullpath + '/dist/index.d.ts'
    const modules = files.map(file => file.slice(srcpath.length + 1, -3))
    const moduleRE = `"(${modules.join('|')})"`
    const [content, meta] = await Promise.all([
      fs.readFile(entry, 'utf8'),
      fs.readJson(fullpath + '/package.json'),
    ])

    const moduleMapper: Record<string, string> = {}
    const starStmts = content.match(new RegExp('import \\* as (.+) from ' + moduleRE + ';\n', 'g')) || []
    starStmts.forEach(stmt => {
      const segments = stmt.split(' ')
      const key = segments[5].slice(1, -3)
      moduleMapper[key] = segments[3]
    })

    await fs.writeFile(entry, content
      .replace(new RegExp('import\\(' + moduleRE + '\\)\\.', 'g'), '')
      .replace(new RegExp('^    (import|export).+ from ' + moduleRE + ';$\n', 'gm'), '')
      .replace(new RegExp('(declare module )' + moduleRE, 'g'), (_, $1, $2) => {
        if (!moduleMapper[$2]) return `${$1}'${meta.name}'`
        return `declare namespace ${moduleMapper[$2]}`
      }))
  }
})
