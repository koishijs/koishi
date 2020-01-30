import { cwd, getWorkspaces, PackageJson, DependencyType } from './utils'
import { cyan, green, yellow } from 'kleur'
import { writeJson } from 'fs-extra'
import { gt, satisfies } from 'semver'
import latest from 'latest-version'
import prompts from 'prompts'
import pMap from 'p-map'
import ora from 'ora'

interface Workspace {
  dirty?: boolean
  path: string
  meta: PackageJson
}

interface Dependency {
  version?: string
  dependents: {
    name: string
    type: DependencyType
  }[]
}

(async () => {
  const workspaces: Record<string, Workspace> = {}
  const dependencies: Record<string, Dependency> = {}

  function loadPackage (path: string) {
    let meta: PackageJson
    try {
      meta = require(`../${path}/package`)
    } catch {
      return
    }
    const { name } = meta
    workspaces[name] = { meta, path }
    delete dependencies[name]

    for (const type of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as DependencyType[]) {
      for (const dep in meta[type] || {}) {
        // skip workspaces and symlinks
        if (workspaces[dep] || meta[type][dep].includes(':')) continue
        if (!dependencies[dep]) dependencies[dep] = { dependents: [] }
        dependencies[dep].dependents.push({ name, type })
      }
    }
  }

  loadPackage('')

  for (const name of await getWorkspaces()) {
    loadPackage(name)
  }

  const depNames = Object.keys(dependencies)
  const spinner = ora(`progress: 0/${depNames.length}`).start()
  let progress = 0
  await pMap(depNames, async (dep) => {
    const version = await latest(dep)
    progress++
    spinner.text = `progress: ${progress}/${depNames.length}`
    return dependencies[dep].version = version.trim()
  }, { concurrency: 10 })
  spinner.succeed()

  const output: string[] = []
  for (const dep in dependencies) {
    const { version, dependents } = dependencies[dep]
    for (const { name, type } of dependents) {
      const workspace = workspaces[name]
      const oldVersion = workspace.meta[type][dep]
      if (gt(version, oldVersion.replace(/^[~^]/, ''))) {
        let update: boolean
        const message = `${name} > ${yellow(dep)}: ${cyan(oldVersion)} -> ${green(version)}`
        if (!satisfies(version, oldVersion)) {
          const result = await prompts({
            name: 'value',
            type: 'confirm',
            message,
          })
          update = result.value
        } else {
          update = true
        }
        if (update) {
          workspace.dirty = true
          workspace.meta[type][dep] = '^' + version
          output.push(message)
        }
      }
    }
  }

  await pMap(Object.keys(workspaces), (name) => {
    const workspace = workspaces[name]
    if (!workspace.dirty) return
    return writeJson(`${cwd}/${workspace.path}/package.json`, workspace.meta, { spaces: 2 })
  })

  console.log(output.sort().join('\n'))
})()
