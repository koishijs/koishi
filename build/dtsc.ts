/* eslint-disable no-cond-assign */

import { spawnAsync, cwd } from './utils'
import { EOL } from 'os'
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
  const srcpath = fullpath.replace(/\\/g, '/') + '/src'
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
  const importMap: Record<string, Record<string, string>> = {}
  const namespaceMap: Record<string, string> = {}

  let prolog = '', epilog = '', cap: RegExpExecArray
  let content = await fs.readFile(entry, 'utf8')
  content = content.split(EOL).filter((line) => {
    if (cap = /^ {4}import \* as (.+) from ["'](.+)["'];$/.exec(line)) {
      if (modules.includes(cap[2])) {
        namespaceMap[cap[2]] = cap[1]
      } else {
        prolog += line.trimStart() + EOL
      }
    } else if (cap = /^ {4}import +(\S*)(?:, *)?(?:\{(.+)\})? from ["'](.+)["'];$/.exec(line)) {
      if (!modules.includes(cap[3])) {
        const map = importMap[cap[3]] ||= {}
        cap[1] && Object.defineProperty(map, 'default', { value: cap[1] })
        cap[2] && cap[2].split(',').map((part) => {
          part = part.trim()
          if (part.includes(' as ')) {
            const [left, right] = part.split(' as ')
            map[left.trimEnd()] = right.trimStart()
          } else {
            map[part] = part
          }
        })
      }
    } else if (line.startsWith('///')) {
      prolog += line + EOL
    } else if (line.startsWith('    export default ')) {
      epilog = line.trimStart() + EOL
    } else {
      return true
    }
  }).join(EOL)

  Object.entries(importMap).forEach(([name, map]) => {
    const output: string[] = []
    const entries = Object.entries(map)
    if (map.default) output.push(map.default)
    if (entries.length) {
      output.push('{ ' + entries.map(([left, right]) => {
        if (left === right) return left
        return `${left} as ${right}`
      }).join(', ') + ' }')
    }
    prolog += `import ${output.join(', ')} from '${name}';${EOL}`
  })

  await fs.writeFile(resolve(fullpath, 'dist/index.d.ts'), prolog + content
    .replace(new RegExp('import\\(' + moduleRE + '\\)\\.', 'g'), '')
    .replace(new RegExp('\r?\n {4}export .+ from ' + moduleRE + ';', 'g'), '')
    .replace(/^declare module ["'](.+)["'] \{\r?\n/gm, (_, $1) => {
      const identifier = namespaceMap[$1]
      if (identifier) return `declare namespace ${identifier} {`
      return ''
    })
    .replace(/^( {4})((module|class|namespace) .+ \{)$/gm, (_, $1, $2) => `${$1}declare ${$2}`)
    .replace(/\r?\n}/g, '')
    .replace(/^ {4}/gm, '') + epilog)
}

async function bundleAll(names: readonly string[]) {
  for (const name of names) {
    await bundle(name)
  }
}

const targets = ['koishi-utils', 'koishi-core', 'plugin-mysql', 'plugin-mongo']
const corePlugins = ['common', 'eval', 'puppeteer', 'teach']

function precedence(name: string) {
  if (name.startsWith('adapter')) return 1
  if (name.startsWith('koishi')) return 5
  const plugin = name.slice(7)
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
