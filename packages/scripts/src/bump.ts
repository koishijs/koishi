import { CAC } from 'cac'
import { writeFile } from 'fs-extra'
import { gt, SemVer } from 'semver'
import { cyan, green } from 'kleur'
import { cwd, exit, getPackages, PackageJson } from './utils'

const bumpTypes = ['major', 'minor', 'patch', 'prerelease', 'version'] as const
type BumpType = typeof bumpTypes[number]

class Package {
  meta: PackageJson
  version: SemVer
  dirty: boolean

  constructor(public path: string) {
    this.meta = require(`${cwd}/${path}/package.json`)
    this.version = new SemVer(this.meta.version)
  }

  bump(flag: BumpType, options: any) {
    if (this.meta.private) return
    let verion = new SemVer(this.meta.version)
    if (!flag) {
      if (verion.prerelease.length) {
        const prerelease = verion.prerelease.slice() as [string, number]
        prerelease[1] += 1
        verion.prerelease = prerelease
      } else {
        verion.patch += 1
      }
    } else if (flag === 'version') {
      verion = new SemVer(options.version)
    } else if (flag === 'prerelease') {
      if (verion.prerelease.length) {
        verion.prerelease = [{
          alpha: 'beta',
          beta: 'rc',
        }[verion.prerelease[0]], 0]
      } else {
        verion = new SemVer(`${verion.major + 1}.0.0-alpha.0`)
      }
    } else {
      if (verion.prerelease.length) {
        verion.prerelease = []
      } else {
        verion[flag] += 1
        if (flag !== 'patch') verion.patch = 0
        if (flag === 'major') verion.minor = 0
      }
    }
    if (gt(verion, this.version)) {
      this.dirty = true
      this.version = verion
      return verion.format()
    }
  }

  save() {
    this.meta.version = this.version.format()
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
      if (node.version.format() === node.meta.version) {
        console.log(`- ${node.meta.name}: updated`)
      } else {
        console.log(`- ${node.meta.name}: ${cyan(node.meta.version)} => ${green(node.meta.version)}`)
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
