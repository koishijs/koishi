import { spawnAsync, getWorkspaces, cwd } from './utils'
import { resolve } from 'path'
import * as fs from 'fs-extra'
import globby from 'globby'
import json5 from 'json5'
import cac from 'cac'

const { args, options } = cac().help().parse()

const prefixes = ['packages/', 'packages/koishi-', 'packages/adapter-', 'packages/plugin-']

delete options['--']

const tsArgs = Object.keys(options).map(name => '--' + name)

async function readJson(path: string) {
  const data = await fs.readFile(path, 'utf8')
  return json5.parse(data)
}

getWorkspaces().then(async (folders) => {
  if (args.length) {
    for (const name of args) {
      await build(folders.find(folder => {
        return folder.endsWith(name) && prefixes.includes(folder.slice(0, -name.length))
      }))
    }
  } else {
    const { references } = await readJson(resolve(cwd, 'tsconfig.json'))
    for (const { path } of references) {
      await build(path)
    }
  }

  async function build(path: string) {
    const fullpath = resolve(cwd, path)
    const srcpath = fullpath + '/src'

    const [files, code, config] = await Promise.all([
      globby(srcpath),
      spawnAsync(['tsc', '-b', path, ...tsArgs]),
      readJson(fullpath + '/tsconfig.json'),
    ])
    if (code) process.exit(code)

    if (!config.compilerOptions.outFile) return
    const entry = resolve(fullpath, config.compilerOptions.outFile)
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
