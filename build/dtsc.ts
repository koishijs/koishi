/* eslint-disable no-cond-assign */

import { spawnAsync, cwd, getPackages, PackageJson } from './utils'
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

interface TsConfig {
  compilerOptions: ts.CompilerOptions
}

const referenceHack = '/// <reference types="koishi/lib" />'

async function bundle(node: Node) {
  const fullpath = resolve(cwd, node.path)
  const { outFile, rootDir } = node.config.compilerOptions

  const srcpath = `${fullpath.replace(/\\/g, '/')}/${rootDir}`
  const [files, content] = await Promise.all([
    getModules(srcpath),
    compile(node.path, resolve(fullpath, outFile)),
  ])

  const moduleRE = `["'](${files.join('|')})["']`
  const internalImport = new RegExp('import\\(' + moduleRE + '\\)\\.', 'g')
  const internalExport = new RegExp('^ {4}export .+ from ' + moduleRE + ';$')
  const internalInject = new RegExp('^declare module ' + moduleRE + ' {$')
  const importMap: Record<string, Record<string, string>> = {}
  const namespaceMap: Record<string, string> = {}

  let prolog = '', cap: RegExpExecArray
  let current: string, temporary: string[]
  let identifier: string, isExportDefault: boolean
  const platforms: Record<string, Record<string, string[]>> = {}
  const output = content.split(EOL).filter((line) => {
    // Step 1: collect informations
    if (isExportDefault) {
      if (line === '    }') isExportDefault = false
      return false
    } else if (temporary) {
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
      if (!coreLibs.includes(node.path) && line !== referenceHack) prolog += line + EOL
    } else if (line.startsWith('    export default ')) {
      if (current === 'index') return true
      if (line.endsWith('{')) isExportDefault = true
      return false
    } else {
      return line.trim() !== 'export {};'
    }
  }).map((line) => {
    // Step 2: flatten module declarations
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
      return line.replace(/^((class|namespace|interface) .+ \{)$/, (_) => `export ${_}`)
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

  return prolog + output + EOL
}

async function wrapModule(name: string, source: string, target: string) {
  const newline = EOL + '    '
  const typings = await fs.readFile(resolve(cwd, source), 'utf8')
  const content = typings.trim().split(EOL).map(line => line.replace(/^declare /, '')).join(newline) + EOL
  await fs.writeFile(
    resolve(cwd, 'packages/koishi/lib', target),
    `declare module "${name}" {${newline}${content}}${EOL}`,
  )
}

async function bundleMain(node: Node) {
  const content = await bundle(node)
  const prolog = [referenceHack]
  const modules: Record<string, string[]> = { koishi: [] }
  let target = ''
  for (const line of content.split(EOL)) {
    if (line.startsWith('///') || line.startsWith('import ')) {
      if (!line.includes('@koishijs/core')) prolog.push(line)
      continue
    }

    if (target) {
      if (line === '}') {
        target = ''
      } else {
        modules[target].push(line)
      }
      continue
    }

    if (!line || line.match(/^export .+ from/)) continue
    const cap = /^declare module ["'](.+)["'] \{$/.exec(line)
    if (cap) {
      target = cap[1] === '@koishijs/core' ? 'koishi' : cap[1]
      modules[target] ||= []
      continue
    }

    modules.koishi.push('    ' + line.replace('Injected', ''))
  }

  for (const name in modules) {
    prolog.push([`declare module '${name}' {`, ...modules[name], '}'].join(EOL))
  }

  await fs.writeFile(resolve(cwd, 'packages/koishi/lib/node.d.ts'), prolog.join(EOL) + EOL)
}

const coreLibs = [
  'packages/utils',
  'packages/core',
]

const whitelist = [
  '@koishijs/plugin-mock',
  '@koishijs/plugin-database-memory',
  '@koishijs/test-utils',
]

async function prepareBuild(nodes: Node[]) {
  if (!nodes.length) return
  await fs.writeFile(cwd + '/tsconfig.temp.json', JSON.stringify({
    files: [],
    references: nodes.map(node => ({ path: './' + node.path })),
  }, null, 2))
}

async function bundleNodes(nodes: Node[]) {
  for (const node of nodes) {
    if (node.path === 'packages/koishi') {
      await Promise.all([
        wrapModule('koishi', 'packages/core/lib/index.d.ts', 'index.d.ts'),
        wrapModule('@koishijs/utils', 'packages/utils/lib/index.d.ts', 'utils.d.ts'),
        bundleMain(node),
      ])
    } else {
      const content = await bundle(node)
      await fs.writeFile(resolve(cwd, node.path, 'lib/index.d.ts'), content)
    }
  }
}

interface Node {
  path?: string
  meta?: PackageJson
  prev?: string[]
  next?: Set<string>
  bundle?: boolean
  config?: TsConfig
  visited?: boolean
}

interface Layer {
  bundle: boolean
  nodes: Node[]
}

;(async () => {
  // Step 1: get relevant packages
  const folders = await getPackages(args)
  if (folders.includes('packages/koishi')) {
    for (const name of coreLibs) {
      if (!folders.includes(name)) folders.push(name)
    }
  }

  // Step 2: initialize nodes
  const nodes: Record<string, Node> = {}
  await Promise.all(folders.map(async (path) => {
    const fullpath = resolve(cwd, path)
    const meta: PackageJson = require(fullpath + '/package.json')
    const config: TsConfig = await readJson(fullpath + '/tsconfig.json')
    if (meta.private) return
    const bundle = !!config.compilerOptions.outFile
    nodes[meta.name] = { path, meta, config, bundle, prev: [], next: new Set() }
  }))

  // Step 3: build dependency graph
  for (const name in nodes) {
    const { meta } = nodes[name]
    const deps = {
      ...meta.dependencies,
      ...meta.devDependencies,
      ...meta.peerDependencies,
    }
    for (const dep in deps) {
      if (whitelist.includes(dep) && !meta.devDependencies[dep] || !nodes[dep]) continue
      nodes[name].prev.push(dep)
      nodes[dep].next.add(name)
    }
    delete nodes[name].meta
  }

  // Step 4: generate bundle workflow
  let bundle = false
  const layers: Layer[] = []
  while (Object.keys(nodes).length) {
    const layer = { bundle, nodes: [] }
    layers.unshift(layer)
    bundle = !bundle
    let flag = true
    while (flag) {
      flag = false
      for (const name of Object.keys(nodes)) {
        const node = nodes[name]
        if (node.bundle === bundle || node.next.size) continue
  
        flag = true
        delete nodes[name]
        layers[0].nodes.unshift(node)
        node.prev.forEach(dep => {
          nodes[dep].next.delete(name)
        })
      }
    }
  }

  // Step 5: generate dts files
  // make sure the number of layers is even
  if (bundle) layers.unshift({ bundle, nodes: [] })
  for (let i = 0; i < layers.length; i += 2) {
    const bundleTargets = layers[i].nodes
    const buildTargets = layers[i + 1].nodes
    await Promise.all([
      prepareBuild(buildTargets),
      bundleNodes(bundleTargets),
    ])
    if (buildTargets.length) {
      const code = await spawnAsync(['tsc', '-b', 'tsconfig.temp.json', ...tsArgs])
      if (code) process.exit(code)
    }
  }
})()
