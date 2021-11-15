import { Adapter, Context, Dict, pick, Schema } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'
import { readdir, readFile } from 'fs/promises'
import { dirname } from 'path'
import { PackageBase, PackageLocal } from './shared'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      packages: PackageProvider
    }
  }
}

function unwrap(module: any) {
  return module.default || module
}

export class PackageProvider extends DataSource<Dict<PackageProvider.Data>> {
  cache: Dict<Promise<PackageProvider.Data>> = {}
  task: Promise<void>

  constructor(ctx: Context, config: PackageProvider.Config) {
    super(ctx, 'packages')

    ctx.on('connect', () => this.start())
  }

  start() {
    this.ctx.on('plugin-added', async (plugin) => {
      const entry = Object.entries(require.cache).find(([, { exports }]) => unwrap(exports) === plugin)
      if (!entry) return
      const state = this.ctx.app.registry.get(plugin)
      const local = await this.cache[entry[0]]
      local.id = state.id
      this.broadcast()
    })

    this.ctx.on('plugin-removed', async (plugin) => {
      const entry = Object.entries(require.cache).find(([, { exports }]) => unwrap(exports) === plugin)
      if (!entry) return
      const local = await this.cache[entry[0]]
      delete local.id
      this.broadcast()
    })
  }

  async prepare() {
    // load local packages
    let { baseDir } = this.ctx.app.options
    while (1) {
      const base = baseDir + '/node_modules'
      const files = await readdir(base).catch(() => [])
      for (const name of files) {
        const base2 = base + '/' + name
        if (name.startsWith('@')) {
          const files = await readdir(base2).catch(() => [])
          for (const name2 of files) {
            if (name === '@koishijs' && name2.startsWith('plugin-') || name2.startsWith('koishi-plugin-')) {
              const fullname = name + '/' + name2
              this.cache[fullname] = this.loadPackage(base + '/' + fullname)
            }
          }
        } else {
          if (name.startsWith('koishi-plugin-')) {
            this.cache[name] = this.loadPackage(base2)
          }
        }
      }
      const parent = dirname(baseDir)
      if (baseDir === parent) break
      baseDir = parent
    }
  }

  async get(forced = false) {
    if (forced || !this.task) {
      this.task = this.prepare()
    }
    await this.task
    return Object.fromEntries((await Promise.all(Object.values(this.cache))).map(data => [data.name, data]))
  }

  private getPluginDeps(deps: Dict<string> = {}) {
    return Object.keys(deps).filter(name => name.startsWith('@koishijs/plugin-') || name.startsWith('koishi-plugin-'))
  }

  private async loadPackage(path: string): Promise<PackageProvider.Data> {
    const data: PackageLocal = JSON.parse(await readFile(path + '/package.json', 'utf8'))
    if (data.private) return null

    // workspace packages are followed by symlinks
    const workspace = !require.resolve(path).includes('node_modules')
    const shortname = data.name.replace(/(koishi-|^@koishijs\/)plugin-/, '')

    // check adapter
    const oldLength = Object.keys(Adapter.library).length
    const exports = unwrap(require(path))
    const newLength = Object.keys(Adapter.library).length
    if (newLength > oldLength) this.ctx.console.sources.protocols.broadcast()

    // check plugin dependencies
    const devDeps = this.getPluginDeps(data.devDependencies)
    const peerDeps = this.getPluginDeps(data.peerDependencies)

    // check plugin state
    const id = this.ctx.app.registry.get(exports)?.id
    const schema = exports?.Config

    return { id, schema, workspace, shortname, devDeps, peerDeps, ...pick(data, ['name', 'version', 'keywords', 'description']) }
  }
}

export namespace PackageProvider {
  export interface Config {}

  export interface Data extends PackageBase {
    id?: string
    shortname: string
    schema?: Schema
    devDeps: string[]
    peerDeps: string[]
    keywords?: string[]
    workspace: boolean
  }
}
