import { Context, pick, Plugin } from 'koishi-core'
import { dirname } from 'path'
import { promises as fs } from 'fs'
import { DataSource } from './data'
import axios from 'axios'

interface PackageBase {
  name: string
  version: string
  description: string
}

export interface PackageJson extends PackageBase {
  private?: boolean
}

export interface PackageMeta {
  'dist-tags': Record<string, string>
}

function debounce(callback: Function, ms: number) {
  let timer: number
  return function () {
    if (timer) clearTimeout(timer)
    timer = setTimeout(callback, ms)
  }
}

export class Registry implements DataSource<Registry.Payload> {
  cached: Promise<Registry.Payload>
  promise: Promise<void>

  static readonly placeholder = Symbol('webui.registry.placeholder')
  static readonly webExtension = Symbol('webui.registry.web-extension')

  constructor(private ctx: Context, public config: Registry.Config) {
    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
  }

  get registry() {
    return this.ctx.app.registry
  }

  update = debounce(async () => {
    this.ctx.webui.broadcast('registry', await this.get(true))
  }, 0)

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    return this.cached = this.getForced()
  }

  private async getForced() {
    return {
      plugins: this.traverse(null).children,
      packages: await this.getPackages(),
    } as Registry.Payload
  }

  async switch(id: string) {
    await this.promise
    for (const [plugin, state] of this.registry) {
      if (id !== state.id) continue
      const replacer = plugin[Registry.placeholder] || {
        [Registry.placeholder]: state.plugin,
        name: state.name,
        apply: () => {},
      }
      this.promise = this.ctx.dispose(plugin)
      state.context.plugin(replacer, state.config)
      break
    }
  }

  private dirCache: Record<string, Promise<string[]>>
  private metaCache: Record<string, Promise<PackageMeta>>

  private async readDir(filename: string) {
    return this.dirCache[filename] ||= fs.readdir(filename)
  }

  private async readData(filename: string): Promise<Registry.PackageData> {
    const data: PackageJson = JSON.parse(await fs.readFile(filename + '/package.json', 'utf8'))
    if (data.private) return null
    const isLocal = !filename.includes('node_modules')
    const meta = await (this.metaCache[data.name] ||= this.getMeta(data.name))
    const latest = !meta || isLocal ? null
      : data.version.includes('-dev.') ? meta['dist-tags'].dev : meta['dist-tags'].latest
    return { isLocal, latest, ...pick(data, ['name', 'version', 'description']) }
  }

  private async getMeta(name: string) {
    try {
      const { data } = await axios.get<PackageMeta>(`https://registry.npmjs.org/${name}`)
      return data
    } catch {}
  }

  private async getPackages() {
    this.dirCache = {}
    this.metaCache = {}

    const loadPackage = async (filename: string) => {
      do {
        filename = dirname(filename)
        const files = await this.readDir(filename)
        if (files.includes('package.json')) break
      } while (true)
      if (filename in packages) return
      packages[filename] = this.readData(filename)
    }

    const packages: Record<string, Promise<Registry.PackageData>> = {}
    const filenames = Object.keys(require.cache).filter((filename) => {
      const { exports } = require.cache[filename]
      return this.registry.has(exports)
    })

    try {
      filenames.push(require.resolve('koishi'))
    } catch {
      filenames.push(require.resolve('koishi-core'))
    }

    await Promise.all(filenames.map(loadPackage))
    const data = await Promise.all(Object.values(packages))
    return data.filter(x => x).sort((a, b) => a.name > b.name ? 1 : -1)
  }

  traverse = (plugin: Plugin): Registry.PluginData => {
    const state = this.registry.get(plugin)
    let webExtension = state[Registry.webExtension]
    let complexity = plugin?.[Registry.placeholder] ? 0 : 1 + state.disposables.length
    const children: Registry.PluginData[] = []
    state.children.forEach((plugin) => {
      const data = this.traverse(plugin)
      complexity += data.complexity
      webExtension ||= data.webExtension
      if (data.name) {
        children.push(data)
      } else {
        children.push(...data.children)
      }
    })
    const { id, name, sideEffect } = state
    children.sort((a, b) => a.name > b.name ? 1 : -1)
    return { id, name, sideEffect, children, complexity, webExtension }
  }
}

export namespace Registry {
  export interface Config {
  }

  export interface PackageData extends PackageBase {
    isLocal: boolean
    latest: string
  }

  export interface PluginData extends Plugin.Meta {
    id: string
    children: PluginData[]
    complexity: number
    webExtension: boolean
  }

  export interface Payload {
    packages: PackageData[]
    plugins: PluginData[]
  }
}
