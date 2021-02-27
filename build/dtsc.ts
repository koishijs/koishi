import { spawnAsync, cwd } from './utils'
import { resolve } from 'path'
import fs from 'fs-extra'
import globby from 'globby'
import json5 from 'json5'
import cac from 'cac'

const { args, options } = cac().help().parse()
delete options['--']
const tsArgs = Object.keys(options).map(name => '--' + name)

async function readJson(path: string) {
  const data = await fs.readFile(path, 'utf8')
  return json5.parse(data)
}

async function bundle(path: string) {
  const fullpath = resolve(cwd, 'packages', path)
  const srcpath = fullpath + '/src'

  const [files, code, config] = await Promise.all([
    globby(srcpath),
    spawnAsync(['tsc', '-b', 'packages/' + path, ...tsArgs]),
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

  await fs.writeFile(resolve(fullpath, 'dist/index.d.ts'), content
    .replace(new RegExp('import\\(' + moduleRE + '\\)\\.', 'g'), '')
    .replace(new RegExp('^    (import|export).+ from ' + moduleRE + ';$\n', 'gm'), '')
    .replace(new RegExp('(declare module )' + moduleRE, 'g'), (_, $1, $2) => {
      if (!moduleMapper[$2]) return `${$1}'${meta.name}'`
      return `declare namespace ${moduleMapper[$2]}`
    }))
}

async function bundleAll(names: readonly string[]) {
  for (const name of names) {
    await bundle(name)
  }
}

const targets = ['koishi-utils', 'koishi-core']
const databases = ['mongo', 'mysql']
const corePlugins = ['common', 'eval', 'puppeteer', 'teach']

function precedence(name: string) {
  if (name.startsWith('adapter')) return 1
  if (name.startsWith('koishi')) return 5
  const plugin = name.slice(7)
  if (databases.includes(plugin)) return 2
  if (corePlugins.includes(plugin)) return 3
  return 4
}

async function prepareConfig() {
  const folders = await fs.readdir(cwd + '/packages')
  await fs.writeFile(cwd + '/tsconfig.temp.json', JSON.stringify({
    files: [],
    references: folders
      .filter(name => !name.startsWith('.') && !targets.includes(name))
      .sort((a, b) => precedence(a) - precedence(b))
      .map(name => ({ path: './packages/' + name })),
  }, null, 2))
}

(async () => {
  if (args.length) {
    await bundleAll(args)
    process.exit(0)
  }

  await Promise.all([
    prepareConfig(),
    bundleAll(targets),
  ])

  const code = await spawnAsync(['tsc', '-b', 'tsconfig.temp.json', ...tsArgs])
  process.exit(code)
})()
