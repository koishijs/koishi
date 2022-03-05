import { cwd, DependencyType, getPackages, PackageJson } from './utils'
import { cyan, green, yellow } from 'kleur'
import { writeJson } from 'fs-extra'
import { gt } from 'semver'
import { CAC } from 'cac'
import latest from 'latest-version'
import pMap from 'p-map'
import ora from 'ora'

class Graph {
  pkgs: Record<string, PackageJson> = {}
  deps: Record<string, Record<string, DependencyType[]>> = {}

  async init(names: string[] = []) {
    this.pkgs = await getPackages(names)

    for (const path in this.pkgs) {
      this.load(path, this.pkgs[path])
    }
  }

  private load(path: string, meta: PackageJson) {
    delete this.deps[meta.name]
    for (const type of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      for (const dep in meta[type] || {}) {
        // skip workspaces and symlinks
        const version = meta[type][dep]
        if (this.pkgs[dep] || !'^~'.includes(version[0])) continue
        const request = dep + ':' + version
        ;((this.deps[request] ||= {})[path] ||= []).push(type)
      }
    }
  }

  async update() {
    const output: string[] = []
    const requests = Object.keys(this.deps)
    const spinner = ora(`progress: 0/${requests.length}`).start()
    let progress = 0
    await pMap(requests, async (request) => {
      const [dep, oldRange] = request.split(':')
      const oldVersion = oldRange.slice(1)
      const newVersion = await latest(dep, { version: oldRange })
      progress++
      spinner.text = `progress: ${progress}/${requests.length}`
      if (!gt(newVersion, oldVersion)) return
      const newRange = oldRange[0] + newVersion
      output.push(`- ${yellow(dep)}: ${cyan(oldVersion)} -> ${green(newRange)}`)
      for (const name in this.deps[request]) {
        Object.defineProperty(this.pkgs[name], '$dirty', { value: true })
        for (const type of this.deps[request][name]) {
          this.pkgs[name][type][dep] = newRange
        }
      }
    }, { concurrency: 10 })
    spinner.succeed()

    for (const path in this.pkgs) {
      if (!this.pkgs[path].$dirty) continue
      await writeJson(`${cwd}/${path}/package.json`, this.pkgs[path], { spaces: 2 })
    }

    console.log(output.sort().join('\n'))
  }
}

export default function (cli: CAC) {
  cli.command('dep [...name]', 'bump dependencies')
    .action(async (names: string[], options) => {
      const graph = new Graph()

      await graph.init(names)
      await graph.update()
    })
}
