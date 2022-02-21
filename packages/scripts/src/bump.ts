import { CAC } from 'cac'
import { writeFile } from 'fs-extra'
import { gt, SemVer } from 'semver'
import { cyan, green } from 'kleur'
import { cwd, exit, getPackages, PackageJson } from './utils'

const bumpTypes = ['major', 'minor', 'patch', 'prerelease', 'version'] as const
type BumpType = typeof bumpTypes[number]

class Package {
  meta: PackageJson
  version: string
  dirty: boolean

  constructor(public path: string) {
    this.meta = require(`${cwd}/${path}/package.json`)
    this.version = this.meta.version
  }

  bump(flag: BumpType, options: any) {
    if (this.meta.private) return
    let version = new SemVer(this.meta.version)
    if (!flag) {
      if (version.prerelease.length) {
        const prerelease = version.prerelease.slice() as [string, number]
        prerelease[1] += 1
        version.prerelease = prerelease
      } else {
        version.patch += 1
      }
    } else if (flag === 'version') {
      version = new SemVer(options.version)
    } else if (flag === 'prerelease') {
      if (version.prerelease.length) {
        version.prerelease = [{
          alpha: 'beta',
          beta: 'rc',
        }[version.prerelease[0]], 0]
      } else {
        version = new SemVer(`${version.major + 1}.0.0-alpha.0`)
      }
    } else {
      if (version.prerelease.length) {
        version.prerelease = []
      } else {
        version[flag] += 1
        if (flag !== 'patch') version.patch = 0
        if (flag === 'major') version.minor = 0
      }
    }
    const formatted = version.format()
    if (gt(formatted, this.version)) {
      this.dirty = true
      this.version = formatted
      return formatted
    }
  }

  save() {
    this.meta.version = this.version
    return writeFile(`${cwd}/${this.path}/package.json`, JSON.stringify(this.meta, null, 2))
  }
}

class Graph {
  nodes: Record<string, Package> = {}

  constructor(public options: any) {}

  async init() {
    const workspaces = await getPackages([])
    for (const path in workspaces) {
      this.nodes[path] = new Package(path)
    }
    return workspaces
  }

  each<T>(callback: (node: Package, path: string) => T) {
    const results: T[] = []
    for (const path in this.nodes) {
      results.push(callback(this.nodes[path], path))
    }
    return results
  }

  bump(node: Package, flag: BumpType) {
    const version = node.bump(flag, this.options)
    if (!version) return
    const dependents = new Set<Package>()
    this.each((target) => {
      const { devDependencies, peerDependencies, dependencies, optionalDependencies } = target.meta
      const { name } = node.meta
      if (target.meta.name === name) return
      Object.entries({ devDependencies, peerDependencies, dependencies, optionalDependencies })
        .filter(([, dependencies = {}]) => dependencies[name])
        .forEach(([type]) => {
          target.meta[type][name] = '^' + version
          target.dirty = true
          if (type !== 'devDependencies') {
            dependents.add(target)
          }
        })
    })
    if (!this.options.recursive) return
    dependents.forEach(dep => this.bump(dep, flag))
  }

  async save() {
    await Promise.all(this.each((node) => {
      if (!node.dirty) return
      if (node.version === node.meta.version) {
        console.log(`- ${node.meta.name}: dependency updated`)
      } else {
        console.log(`- ${node.meta.name}: ${cyan(node.meta.version)} => ${green(node.version)}`)
      }
      return node.save()
    }))
  }
}

export default function (cli: CAC) {
  cli.command('bump [...names]', 'bump versions')
    .option('-1, --major', '')
    .option('-2, --minor', '')
    .option('-3, --patch', '')
    .option('-p, --prerelease', '')
    .option('-v, --version <ver>', '')
    .option('-r, --recursive', '')
    .action(async (names: string[], options) => {
      if (!names) exit('no package specified')

      const graph = new Graph(options)
      const workspaces = await graph.init()
      const packages = await getPackages(names, { workspaces })

      const flag = (() => {
        for (const type of bumpTypes) {
          if (type in options) return type
        }
      })()

      for (const path in packages) {
        graph.bump(graph.nodes[path], flag)
      }

      await graph.save()
    })
}
