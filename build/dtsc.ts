/* eslint-disable no-cond-assign */

import { spawnAsync, cwd } from './utils'
import { EOL } from 'os'
import { resolve } from 'path'
import fs from 'fs-extra'
import globby from 'globby'
import json5 from 'json5'
import cac from 'cac'
import ts from 'typescript'

const { args, options } = cac().help().parse()
delete options['--']
const tsArgs = Object.keys(options).map(name => '--' + name)

async function readJson(path: string) {
  const data = await fs.readFile(path, 'utf8')
  return json5.parse(data)
}

async function getModules(srcpath: string) {
  const files = await globby(srcpath)
  return files.map(file => file.slice(srcpath.length + 1, -3))
}

async function compile(path: string, filename: string) {
  const code = await spawnAsync(['tsc', '-b', 'packages/' + path, ...tsArgs])
  if (code) process.exit(code)
  return fs.readFile(filename, 'utf8')
}

async function bundle(path: string) {
  const fullpath = resolve(cwd, 'packages', path)
  const config = await readJson(fullpath + '/tsconfig.json')
  const { outFile, rootDir } = config.compilerOptions as ts.CompilerOptions
  if (!outFile) return

  const srcpath = `${fullpath.replace(/\\/g, '/')}/${rootDir}`
  const [files, content] = await Promise.all([getModules(srcpath), compile(path, resolve(fullpath, outFile))])

  const moduleRE = `"(${files.join('|')})"`
  const internalImport = new RegExp('import\\(' + moduleRE + '\\)\\.', 'g')
  const internalExport = new RegExp('^ {4}export .+ from ' + moduleRE + ';$')
  const internalInject = new RegExp('^declare module ' + moduleRE + ' {$')
  const importMap: Record<string, Record<string, string>> = {}
  const namespaceMap: Record<string, string> = {}

  let prolog = '', epilog = '', cap: RegExpExecArray, identifier: string
  const output = content.split(EOL).filter((line) => {
    if (cap = /^ {4}import ["'](.+)["'];$/.exec(line)) {
      if (!files.includes(cap[1])) prolog += line.trimStart() + EOL
    } else if (cap = /^ {4}import \* as (.+) from ["'](.+)["'];$/.exec(line)) {
      if (files.includes(cap[2])) {
        namespaceMap[cap[2]] = cap[1]
      } else {
        prolog += line.trimStart() + EOL
      }
    } else if (cap = /^ {4}import +(\S*)(?:, *)?(?:\{(.+)\})? from ["'](.+)["'];$/.exec(line)) {
      if (files.includes(cap[3])) return
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
    } else if (line.startsWith('///')) {
      prolog += line + EOL
    } else if (line.startsWith('    export default ')) {
      epilog = line.trimStart() + EOL
    } else {
      return true
    }
  }).map((line) => {
    if (cap = /^declare module ["'](.+)["'] \{( \})?$/.exec(line)) {
      if (cap[2]) return ''
      identifier = namespaceMap[cap[1]]
      return identifier ? `declare namespace ${identifier} {` : ''
    } else if (line === '}') {
      return identifier ? '}' : ''
    } else if (!internalExport.exec(line)) {
      if (!identifier) line = line.slice(4)
      return line
        .replace(internalImport, '')
        .replace(/import\("index"\)/g, 'import(".")')
        .replace(/^((module|class|namespace) .+ \{)$/, (_) => `declare ${_}`)
    } else {
      return ''
    }
  }).map((line) => {
    if (cap = internalInject.exec(line)) {
      identifier = '@internal'
      return ''
    } else if (line === '}') {
      return identifier ? identifier = '' : '}'
    } else {
      if (identifier) line = line.slice(4)
      return line.replace(/^((class|namespace) .+ \{)$/, (_) => `export ${_}`)
    }
  }).filter(line => line).join(EOL)

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

  await fs.writeFile(resolve(fullpath, 'lib/index.d.ts'), prolog + output + epilog)
}

async function bundleAll(names: readonly string[]) {
  for (const name of names) {
    await bundle(name)
  }
}

const targets = [
  'koishi-utils',
  'koishi-core',
  'plugin-common',
  'plugin-mysql',
  'plugin-mongo',
  'plugin-webui',
  'plugin-teach',
  'plugin-adventure',
]

const corePlugins = ['eval', 'puppeteer']

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
