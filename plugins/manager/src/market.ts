import { Context, Dict, version as currentVersion, Schema, Quester } from 'koishi'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { spawn, StdioOptions } from 'child_process'
import { satisfies } from 'semver'
import { DataSource } from '@koishijs/plugin-console'
import { throttle } from 'throttle-debounce'
import { PackageBase, PackageRegistry } from './shared'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      market: MarketProvider
    }
  }
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

function unwrap(module: any) {
  return module.default || module
}

export class MarketProvider extends DataSource<MarketProvider.Data[]> {
  dataCache: Dict<MarketProvider.Data> = {}
  localCache: Dict<Promise<MarketProvider.Local>> = {}
  callbacks: ((data: MarketProvider.Data[]) => void)[] = []
  flushData: throttle<() => void>
  http: Quester

  constructor(ctx: Context, private config: MarketProvider.Config) {
    super(ctx, 'market')

    this.http = ctx.http.extend({
      endpoint: config.endpoint,
    })

    ctx.on('connect', () => this.start())
  }

  start() {
    const logger = this.ctx.logger('status')
    this.prepare().catch(logger.warn)
    this.flushData = throttle(100, () => this.broadcast())
  }

  stop() {
    this.flushData.cancel()
  }

  private getRegistry(name: string) {
    return this.http.get<PackageRegistry>(`/${name}`)
  }

  private getSuggestions() {
    return this.ctx.http.get<PackageBase[]>('https://www.npmjs.com/search/suggestions?q=koishi+plugin&size=250')
  }

  async prepare() {
    const data = await this.getSuggestions()

    data.forEach(async (item) => {
      const { name, version } = item
      const official = name.startsWith('@koishijs/plugin-')
      const community = name.startsWith('koishi-plugin-')
      if (!official && !community) return

      const data = await this.getRegistry(name)
      const { dependencies, peerDependencies, dist, keywords, description, deprecated } = data.versions[version]
      const declaredVersion = { ...dependencies, ...peerDependencies }['koishi']
      if (deprecated || !declaredVersion || !satisfies(currentVersion, declaredVersion)) return

      const shortname = official ? name.slice(17) : name.slice(14)
      this.dataCache[name] = {
        ...item,
        shortname,
        official,
        description: description,
        keywords: keywords || [],
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
    endpoint?: string
  }

  export const Config = Schema.object({
    endpoint: Schema.string('要使用的 npm registry 终结点。').default('https://registry.npmjs.org'),
  })

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
    official: boolean
    keywords: string[]
    size: number
  }
}
