import { Adapter, App, Context, Dict, Logger, pick, Plugin, remove, Schema } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { conclude, Manifest, PackageJson } from '@koishijs/market'
import { promises as fsp } from 'fs'
import { dirname } from 'path'
import ns from 'ns-require'
import {} from '@koishijs/cli'
import { loadManifest } from './utils'

const logger = new Logger('market')

/** require without affecting the dependency tree */
function getExports(id: string) {
  const path = require.resolve(id)
  const keys = Object.keys(require.cache)
  let result = require.cache[path]
  if (!result) {
    require(path)
    result = require.cache[path]
    remove(module.children, result)
    for (const key in require.cache) {
      if (!keys.includes(key)) {
        delete require.cache[key]
      }
    }
  }
  return ns.unwrapExports(result.exports)
}

class PackageProvider extends DataService<Dict<PackageProvider.Data>> {
  cache: Dict<PackageProvider.Data> = {}
  task: Promise<void>

  constructor(ctx: Context, config: PackageProvider.Config) {
    super(ctx, 'packages', { authority: 4 })

    this.ctx.on('plugin-added', async (state) => {
      this.updatePackage(state.plugin, state.uid)
    })

    this.ctx.on('plugin-removed', async (state) => {
      this.updatePackage(state.plugin, null)
    })
  }

  get registry() {
    return this.ctx.app.registry
  }

  private async updatePackage(plugin: Plugin, id: number) {
    const entry = Object.keys(require.cache).find((key) => {
      return ns.unwrapExports(require.cache[key].exports) === plugin
    })
    if (!this.cache[entry]) return
    const local = this.cache[entry]
    local.id = id
    this.refresh()
  }

  async prepare() {
    this.cache = {}
    let { baseDir } = this.ctx.app
    const tasks: Promise<void>[] = []
    while (1) {
      tasks.push(this.loadDirectory(baseDir))
      const parent = dirname(baseDir)
      if (baseDir === parent) break
      baseDir = parent
    }
    await Promise.all(tasks)
  }

  async get(forced = false) {
    if (forced) delete this.task
    await (this.task ||= this.prepare())

    // add app config
    const packages = Object.values(this.cache)
    packages.unshift({
      name: '',
      shortname: '',
      schema: App.Config,
    })

    return Object.fromEntries(packages.filter(x => x).map(data => [data.name, data]))
  }

  private async loadDirectory(baseDir: string) {
    const base = baseDir + '/node_modules'
    const files = await fsp.readdir(base).catch(() => [])
    for (const name of files) {
      const base2 = base + '/' + name
      if (name.startsWith('@')) {
        const files = await fsp.readdir(base2).catch(() => [])
        for (const name2 of files) {
          if (name === '@koishijs' && name2.startsWith('plugin-') || name2.startsWith('koishi-plugin-')) {
            this.loadPackage(name + '/' + name2, base2 + '/' + name2)
          }
        }
      } else {
        if (name.startsWith('koishi-plugin-')) {
          this.loadPackage(name, base2)
        }
      }
    }
  }

  private loadPackage(name: string, path: string) {
    try {
      // require.resolve(name) may be different from require.resolve(path)
      // because tsconfig-paths may resolve the path differently
      this.cache[require.resolve(name)] = this.parsePackage(name)
    } catch (error) {
      logger.warn('failed to parse %c', name)
      logger.debug(error)
    }
  }

  private parsePackage(name: string) {
    const data = loadManifest(name)
    const result = pick(data, [
      'name',
      'version',
      'description',
    ]) as PackageProvider.Data

    // workspace packages are followed by symlinks
    result.workspace = data.$workspace
    result.shortname = data.name.replace(/(koishi-|^@koishijs\/)plugin-/, '')
    result.manifest = conclude(data)
    result.peerDependencies = { ...data.peerDependencies }

    // check adapter
    const oldLength = Object.keys(Adapter.library).length
    const exports = getExports(name)
    const newLength = Object.keys(Adapter.library).length
    if (newLength > oldLength) this.ctx.console.protocols.refresh()

    // check plugin state
    const runtime = this.registry.get(exports)
    result.id = runtime?.uid
    result.forkable = runtime?.isForkable
    result.schema = exports?.Config || exports?.schema

    // make sure that result can be serialized into json
    JSON.stringify(result)

    return result
  }
}

namespace PackageProvider {
  export interface Config {}

  export interface Data extends Partial<PackageJson> {
    id?: number
    forkable?: boolean
    shortname?: string
    schema?: Schema
    workspace?: boolean
    manifest?: Manifest
  }
}

export default PackageProvider
