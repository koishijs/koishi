import { CAC } from 'cac'
import { mkdir, readdir, readFile, writeFile } from 'fs-extra'
import { buildExtension } from '@koishijs/client/lib'
import { cwd, getPackages, PackageJson, spawnAsync, TsConfig } from './utils'
import { extname } from 'path'
import yaml from 'js-yaml'
import ora from 'ora'

interface Node {
  path?: string
  meta?: PackageJson
  prev?: string[]
  next?: Set<string>
}

function initGraph(packages: Record<string, PackageJson>) {
  const nodes: Record<string, Node> = {}
  for (const path in packages) {
    const meta = packages[path]
    if (!meta.main) return
    nodes[meta.name] = { path, meta, prev: [], next: new Set() }
  }

  for (const name in nodes) {
    const { meta } = nodes[name]
    const deps = {
      ...meta.dependencies,
      ...meta.devDependencies,
      ...meta.peerDependencies,
    }
    for (const dep in deps) {
      if (!nodes[dep]) continue
      nodes[name].prev.push(dep)
      nodes[dep].next.add(name)
    }
    delete nodes[name].meta
  }

  return nodes
}

async function buildGraph(nodes: Record<string, Node>) {
  function check(name: string) {
    const node = nodes[name]
    if (node.next.size) return true
    delete nodes[name]
    config.references.unshift({ path: '.' + node.path })
    node.prev.forEach(dep => {
      nodes[dep].next.delete(name)
    })
  }

  let names: string[]
  const config: TsConfig = { files: [], references: [] }
  do {
    names = Object.keys(nodes)
  } while (names.length && !names.every(check))

  if (names.length) {
    console.log(nodes)
    throw new Error('circular dependency detected')
  }

  if (!config.references.length) return
  await writeFile(cwd + '/tsconfig.temp.json', JSON.stringify(config, null, 2))

  const code = await spawnAsync(['tsc', '-b', 'tsconfig.temp.json'])
  if (code) process.exit(code)
}

async function buildYamlFile(source: string, target: string, file: string) {
  const content = await readFile(source + '/' + file, 'utf8')
  const ext = extname(file)
  const name = file.slice(0, -ext.length)
  switch (ext) {
    case '.yaml':
    case '.yml':
      await writeFile(target + '/' + name + '.json', JSON.stringify(yaml.load(content)))
      break
    default:
      await writeFile(target + '/' + file, content)
  }
}

async function buildYamlPackage(path: string) {
  const source = cwd + path + '/src/locales'
  const target = cwd + path + '/lib/locales'
  const files = await readdir(source)
  await mkdir(target, { recursive: true })
  await Promise.all(files.map((file) => {
    return buildYamlFile(source, target, file)
  }))
}

export default function (cli: CAC) {
  cli.command('build [...name]', 'build packages')
    .action(async (names: string[], options) => {
      const spinner = ora()

      spinner.start('loading packages')
      const packages = await getPackages(names)
      spinner.succeed()

      spinner.start('building typescript')
      const nodes = initGraph(packages)
      await buildGraph(nodes)
      spinner.succeed()

      spinner.start('building locales')
      await Promise.all(Object.keys(packages).map((path) => {
        return buildYamlPackage(path).catch(() => {})
      }))
      spinner.succeed()

      spinner.start('building client')
      for (const path in packages) {
        await buildExtension(cwd + path)
      }
      spinner.succeed()
    })
}
