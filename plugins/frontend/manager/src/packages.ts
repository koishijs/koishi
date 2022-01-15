import { Adapter, App, Context, Dict, omit, pick, Plugin, remove, Schema } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'
import { promises as fsp } from 'fs'
import { dirname } from 'path'
import { Package } from './utils'
import {} from '@koishijs/cli'

const { readdir, readFile } = fsp

function unwrap(module: any) {
  return module.default || module
}

/** require without affecting the dependency tree */
function getExports(id: string) {
  const path = require.resolve(id)
  let result = require.cache[path]
  if (!result) {
    require(path)
    result = require.cache[path]
    remove(module.children, result)
    delete require.cache[path]
  }
  return unwrap(result.exports)
}

export class PackageProvider extends DataSource<Dict<PackageProvider.Data>> {
  cache: Dict<Promise<PackageProvider.Data>> = {}
  task: Promise<void>

  constructor(ctx: Context, config: PackageProvider.Config) {
    super(ctx, 'packages')
  }

  start() {
    this.task = this.prepare()

    this.ctx.on('plugin-added', async (plugin) => {
      const state = this.ctx.app.registry.get(plugin)
      this.updatePackage(plugin, state.id)
    })

    this.ctx.on('plugin-removed', async (plugin) => {
      this.updatePackage(plugin, null)
    })
  }

  private async updatePackage(plugin: Plugin, id: string) {
    const entry = Object.keys(require.cache).find((key) => {
      return unwrap(require.cache[key].exports) === plugin
    })
    if (!this.cache[entry]) return
    const local = await this.cache[entry]
    local.id = id
    this.broadcast()
  }

  async prepare() {
    // load local packages
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

  async get() {
    await this.task

    // add app config
    const packages = await Promise.all(Object.values(this.cache))
    packages.unshift({
      name: '',
      shortname: '',
      schema: App.Config,
      config: omit(this.ctx.app.options, ['plugins' as any]),
    })

    return Object.fromEntries(packages.filter(x => x).map(data => [data.name, data]))
  }

  private async loadDirectory(baseDir: string) {
    const base = baseDir + '/node_modules'
    const files = await readdir(base).catch(() => [])
    for (const name of files) {
      const base2 = base + '/' + name
      if (name.startsWith('@')) {
        const files = await readdir(base2).catch(() => [])
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
    // require.resolve(name) may be different from require.resolve(path)
    // because tsconfig-paths may resolve the path differently
    this.cache[require.resolve(name)] = this.parsePackage(name, path)
  }

  private async parsePackage(name: string, path: string) {
    const data: Package.Local = JSON.parse(await readFile(path + '/package.json', 'utf8'))
    const result = pick(data, ['name', 'version', 'description']) as PackageProvider.Data

    // workspace packages are followed by symlinks
    result.workspace = !require.resolve(name).includes('node_modules')
    result.shortname = data.name.replace(/(koishi-|^@koishijs\/)plugin-/, '')

    // check adapter
    const oldLength = Object.keys(Adapter.library).length
    const exports = getExports(name)
    const newLength = Object.keys(Adapter.library).length
    if (newLength > oldLength) this.ctx.console.services.protocols.broadcast()

    // check plugin dependencies
    Object.assign(result, Package.Meta.from(data))

    // check plugin state
    const state = this.ctx.app.registry.get(exports)
    result.id = state?.id
    result.config = state?.config
    result.schema = exports?.Config || exports?.schema

    // get config for disabled plugins
    if (!result.config) {
      const { plugins = {} } = this.ctx.app.options
      result.config = plugins['~' + result.shortname]
    }

    return result
  }
}

export namespace PackageProvider {
  export interface Config {}

  export interface Data extends Partial<Package.Base> {
    id?: string
    config?: any
    shortname?: string
    schema?: Schema
    devDeps?: string[]
    peerDeps?: string[]
    keywords?: string[]
    workspace?: boolean
  }
}
