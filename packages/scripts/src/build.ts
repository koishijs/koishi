import { CAC } from 'cac'
import { writeFile } from 'fs-extra'
import { cwd, getPackages, PackageJson, spawnAsync, TsConfig } from './utils'

interface Node {
  path?: string
  meta?: PackageJson
  prev?: string[]
  next?: Set<string>
}

function initGraph(names: string[]) {
  const packages = getPackages(names)
  const nodes: Record<string, Node> = {}
  for (const path in packages) {
    const meta = packages[path]
    if (!meta || meta.private) return
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
    config.references.unshift({ path: './' + node.path })
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

export default function (cli: CAC) {
  cli.command('build [...name]', 'build packages')
    .action(async (names: string[], options) => {
      const nodes = initGraph(names)
      await buildGraph(nodes)
    })
}
