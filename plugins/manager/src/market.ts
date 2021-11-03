import { Context, pick, Dict, version as currentVersion, Schema, Adapter } from 'koishi'
import { dirname, resolve } from 'path'
import { existsSync, promises as fs } from 'fs'
import { spawn, StdioOptions } from 'child_process'
import { satisfies } from 'semver'
import { DataSource } from '@koishijs/plugin-console'
import { throttle } from 'throttle-debounce'

declare module '@koishijs/plugin-console' {
  namespace DataSource {
    interface Library {
      market: MarketProvider
    }
  }
}

interface PackageBase {
  name: string
  version: string
  description: string
}

interface PackageJson extends PackageBase {
  keywords?: string[]
  dependencies?: Dict<string>
  devDependencies?: Dict<string>
  peerDependencies?: Dict<string>
  optionalDependencies?: Dict<string>
}

interface PackageLocal extends PackageJson {
  private?: boolean
}

interface PackageRemote extends PackageJson {
  deprecated?: string
  dist: {
    unpackedSize: number
  }
}

interface Registry extends PackageBase {
  versions: Dict<PackageRemote>
}

type Manager = 'yarn' | 'npm'

const cwd = process.cwd()

function execute(bin: string, args: string[] = [], stdio: StdioOptions = 'inherit') {
  // fix for #205
  // https://stackoverflow.com/questions/43230346/error-spawn-npm-enoent
  const child = spawn(bin + (process.platform === 'win32' ? '.cmd' : ''), args, { stdio })
  return new Promise<number>((resolve) => {
    child.on('close', resolve)
  })
}

let _managerPromise: Promise<Manager>
async function getManager(): Promise<Manager> {
  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(resolve(cwd, 'package-lock.json'))) return 'npm'
  if (!await execute('yarn', ['--version'], 'ignore')) return 'yarn'
  return 'npm'
}

const installArgs: Record<Manager, string[]> = {
  yarn: ['add'],
  npm: ['install', '--loglevel', 'error'],
}

export class MarketProvider extends DataSource<MarketProvider.Data[]> {
  dataCache: Dict<MarketProvider.Data> = {}
  localCache: Dict<Promise<MarketProvider.Local>> = {}
  callbacks: ((data: MarketProvider.Data[]) => void)[] = []
  flushData: throttle<() => void>

  constructor(ctx: Context, private config: MarketProvider.Config) {
    super(ctx, 'market')
    
    ctx.on('connect', () => this.start())
  }

  start() {
    const logger = this.ctx.logger('status')
    this.prepare().catch(logger.warn)
    this.flushData = throttle(100, () => this.broadcast())

    this.ctx.on('plugin-added', async (plugin) => {
      const entry = Object.entries(require.cache).find(([, { exports }]) => exports === plugin)
      if (!entry) return
      const state = this.ctx.app.registry.get(plugin)
      const local = await this.localCache[entry[0]]
      local.id = state.id
      this.broadcast()
    })

    this.ctx.on('plugin-removed', async (plugin) => {
      const entry = Object.entries(require.cache).find(([, { exports }]) => exports === plugin)
      if (!entry) return
      const local = await this.localCache[entry[0]]
      delete local.id
      this.broadcast()
    })
  }

  stop() {
    this.flushData.cancel()
  }

  private getPluginDeps(deps: Dict<string> = {}) {
    return Object.keys(deps).filter(name => name.startsWith('@koishijs/plugin-') || name.startsWith('koishi-plugin-'))
  }

  private async loadPackage(path: string, id?: string): Promise<MarketProvider.Local> {
    const data: PackageLocal = JSON.parse(await fs.readFile(path + '/package.json', 'utf8'))
    if (data.private) return null
    const workspace = !path.includes('node_modules')

    // check adapter
    const oldLength = Object.keys(Adapter.library).length
    const { schema } = require(path)
    const newLength = Object.keys(Adapter.library).length
    if (newLength > oldLength) this.ctx.webui.sources.registry.update()

    const devDeps = this.getPluginDeps(data.devDependencies)
    const peerDeps = this.getPluginDeps(data.peerDependencies)

    return { schema, workspace, devDeps, peerDeps, id, ...pick(data, ['name', 'version', 'keywords', 'description']) }
  }

  private async loadActive(filename: string, id?: string) {
    do {
      filename = dirname(filename)
      const files = await fs.readdir(filename)
      if (files.includes('package.json')) break
    } while (true)
    return this.loadPackage(filename, id)
  }

  private async loadLocal(name: string) {
    try {
      const filename = require.resolve(name)
      const path = require.resolve(name + '/package.json').slice(0, -12)
      return this.localCache[filename] ||= this.loadPackage(path)
    } catch {}
  }

  private getRegistry(name: string) {
    return this.ctx.http.get<Registry>(`https://registry.npmjs.org/${name}`)
  }

  private getSuggestions() {
    return this.ctx.http.get<PackageBase[]>('https://www.npmjs.com/search/suggestions?q=koishi+plugin&size=250')
  }

  async prepare() {
    const [data] = await Promise.all([
      this.getSuggestions(),
      Promise.all(Object.keys(require.cache).map(async (filename) => {
        const { exports } = require.cache[filename]
        const state = this.ctx.app.registry.get(exports)
        if (!state) return
        return this.localCache[filename] = this.loadActive(filename, state.id)
      })),
    ])

    data.forEach(async (item) => {
      const { name, version } = item
      const official = name.startsWith('@koishijs/plugin-')
      const community = name.startsWith('koishi-plugin-')
      if (!official && !community) return

      const [local, data] = await Promise.all([
        this.loadLocal(name),
        this.getRegistry(name),
      ])
      const { dependencies, peerDependencies, dist, keywords, description, deprecated } = data.versions[version]
      const declaredVersion = { ...dependencies, ...peerDependencies }['koishi']
      if (deprecated || !declaredVersion || !satisfies(currentVersion, declaredVersion)) return

      const shortname = official ? name.slice(17) : name.slice(14)
      this.dataCache[name] = {
        ...item,
        shortname,
        local,
        official,
        description: local?.description || description,
        keywords: local?.keywords || keywords || [],
        size: dist.unpackedSize,
      }
      this.flushData()
    })
  }

  async get() {
    return Object.values(this.dataCache)
  }

  async install(name: string) {
    const kind = await (_managerPromise ||= getManager())
    const args = [...installArgs[kind], name]
    await execute(kind, args)
    this.get()
    this.broadcast()
  }
}

export namespace MarketProvider {
  export interface Config {
    apiPath?: string
  }

  export interface Local extends PackageBase {
    id?: string
    schema?: Schema
    devDeps: string[]
    peerDeps: string[]
    keywords?: string[]
    workspace: boolean
  }

  export interface Data extends PackageBase {
    shortname: string
    local?: Local
    official: boolean
    keywords: string[]
    size: number
  }
}
