/* eslint-disable no-cond-assign */

import { spawnAsync, cwd, getPackages } from './utils'
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
  const code = await spawnAsync(['tsc', '-b', path, ...tsArgs])
  if (code) process.exit(code)
  return fs.readFile(filename, 'utf8')
}

async function bundle(path: string) {
  const fullpath = resolve(cwd, path)
  const config = await readJson(fullpath + '/tsconfig.json')
  const { outFile, rootDir } = config.compilerOptions as ts.CompilerOptions
  if (!outFile) return

  const srcpath = `${fullpath.replace(/\\/g, '/')}/${rootDir}`
  const [files, content] = await Promise.all([
    getModules(srcpath),
    compile(path, resolve(fullpath, outFile)),
  ])

  const moduleRE = `["'](${files.join('|')})["']`
  const internalImport = new RegExp('import\\(' + moduleRE + '\\)\\.', 'g')
  const internalExport = new RegExp('^ {4}export .+ from ' + moduleRE + ';$')
  const internalInject = new RegExp('^declare module ' + moduleRE + ' {$')
  const importMap: Record<string, Record<string, string>> = {}
  const namespaceMap: Record<string, string> = {}

  let prolog = '', cap: RegExpExecArray
  let current: string, temporary: string[]
  let identifier: string
  const platforms: Record<string, Record<string, string[]>> = {}
  const output = content.split(EOL).filter((line) => {
    // Phase 1: collect informations
    if (temporary) {
      if (line === '}') return temporary = null
      temporary.push(line)
    } else if (cap = /^declare module ["'](.+)["'] \{( \})?$/.exec(line)) {
      //                                  ^1
      // ignore empty module declarations
      if (cap[2]) return temporary = null
      current = cap[1]
      const segments = current.split(/\//g)
      const lastName = segments.pop()
      if (['node', 'browser'].includes(lastName) && segments.length) {
        temporary = (platforms[segments.join('/')] ||= {})[lastName] = []
      } else {
        return true
      }
    } else if (cap = /^ {4}import ["'](.+)["'];$/.exec(line)) {
      //                       ^1
      // import module directly
      if (!files.includes(cap[1])) prolog += line.trimStart() + EOL
    } else if (cap = /^ {4}import \* as (.+) from ["'](.+)["'];$/.exec(line)) {
      //                                ^1            ^2
      // import as namespace
      if (files.includes(cap[2])) {
        // mark internal module as namespace
        namespaceMap[cap[2]] = cap[1]
      } else if (!prolog.includes(line.trimStart())) {
        // preserve external module imports once
        prolog += line.trimStart() + EOL
      }
    } else if (cap = /^ {4}import (\S*)(?:, *)?(?:\{(.+)\})? from ["'](.+)["'];$/.exec(line)) {
      //                          ^1                ^2                ^3
      // ignore internal imports
      if (files.includes(cap[3])) return
      // handle aliases from external imports
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
      if (!corePackages.includes(path) && line !== referenceHack) prolog += line + EOL
    } else if (line.startsWith('    export default ')) {
      return current === 'index'
    } else {
      return line.trim() !== 'export {};'
    }
  }).map((line) => {
    // Phase 2: flatten module declarations
    if (cap = /^declare module ["'](.+)["'] \{$/.exec(line)) {
      if (identifier = namespaceMap[cap[1]]) {
        return `declare namespace ${identifier} {`
      } else {
        return ''
      }
    } else if (line === '}') {
      return identifier ? '}' : ''
    } else if (!internalExport.exec(line)) {
      if (!identifier) line = line.slice(4)
      return line
        .replace(internalImport, '')
        .replace(/import\("index"\)/g, "import('.')")
        .replace(/^(module|class|namespace|const) /, (_) => `declare ${_}`)
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

  await fs.writeFile(resolve(fullpath, 'lib/index.d.ts'), prolog + output + EOL)
}

async function wrapModule(name: string, source: string, target: string) {
  const newline = EOL + '    '
  const typings = await fs.readFile(resolve(cwd, source), 'utf8')
  const content = typings.trim().split(EOL).join(newline) + EOL
  await fs.writeFile(
    resolve(cwd, 'packages/koishi/lib', target),
    `declare module "${name}" {${newline}${content}}${EOL}`,
  )
}

const referenceHack = '/// <reference types="koishi/lib" />'

async function bundleNode() {
  let cap: RegExpExecArray
  const typings = await compile('packages/koishi', resolve(cwd, 'packages/koishi/temp/index.d.ts'))
  const prolog = [referenceHack]
  const modules: Record<string, string[]> = {}
  let current: string
  for (const line of typings.split(EOL)) {
    if (line.startsWith('///')) {
      prolog.push(line)
    } else if (cap = /^ {4}import .+ from ['"](.+)['"];$/.exec(line)) {
      if (!cap[1].includes('@koishijs')) prolog.push(line.slice(4))
    } else if (cap = /^ {4}module ['"](.+)['"] \{$/.exec(line)) {
      current = cap[1]
      if (current === '@koishijs/core') current = 'koishi'
    } else if (current) {
      if (line === '    }') {
        current = ''
      } else {
        (modules[current] ||= []).push(line.slice(4))
      }
    } else if (line.startsWith('    ')) {
      const content = line.slice(4)
      if (content.startsWith('import ') || /^export .+ from/.test(content)) continue
      if (content.startsWith('export namespace Injected')) {
        (modules.koishi ||= []).push('    namespace ' + line.slice(29))
      } else {
        (modules.koishi ||= []).push(line)
      }
    }
  }
  for (const name in modules) {
    prolog.push(`declare module '${name}' {`, ...modules[name], '}')
  }
  await fs.writeFile(
    resolve(cwd, 'packages/koishi/lib/node.d.ts'),
    prolog.join(EOL) + EOL,
  )
}

async function bundleAll(names: readonly string[]) {
  for (const name of names) {
    if (name === 'packages/koishi') {
      await Promise.all([
        wrapModule('koishi', 'packages/core/lib/index.d.ts', 'index.d.ts'),
        wrapModule('@koishijs/utils', 'packages/utils/lib/index.d.ts', 'utils.d.ts'),
        bundleNode(),
      ])
    } else {
      await bundle(name)
    }
  }
}

const targets = [
  'packages/utils',
  'packages/core',
  'packages/koishi',
  'plugins/common',
  'plugins/mysql',
  'plugins/mongo',
  'plugins/webui',
  'plugins/teach',
  'plugins/adventure',
]

const corePackages = [
  'packages/utils',
  'packages/core',
]

const corePlugins = [
  'plugins/eval',
  'plugins/puppeteer',
]

function precedence(name: string) {
  if (name.startsWith('packages/')) return 5
  if (corePlugins.includes(name)) return 3
  return 4
}

async function prepareConfig(folders: string[]) {
  if (!folders.length) return
  await fs.writeFile(cwd + '/tsconfig.temp.json', JSON.stringify({
    files: [],
    references: folders
      .sort((a, b) => precedence(a) - precedence(b))
      .map(name => ({ path: './' + name })),
  }, null, 2))
}

(async () => {
  const folders = await getPackages(args)
  if (folders.includes('packages/koishi')) {
    if (!folders.includes('packages/core')) folders.push('packages/core')
    if (!folders.includes('packages/utils')) folders.push('packages/utils')
  }
  const buildTargets = folders.filter(name => !targets.includes(name) && !name.includes('ui-'))
  const bundleTargets = folders.filter(name => targets.includes(name) && !name.includes('ui-'))

  await Promise.all([
    prepareConfig(buildTargets),
    bundleAll(bundleTargets),
  ])

  if (buildTargets.length) {
    const code = await spawnAsync(['tsc', '-b', 'tsconfig.temp.json', ...tsArgs])
    process.exit(code)
  }
})()
