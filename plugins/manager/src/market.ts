import { Context, Dict, version as currentVersion, Schema, Quester, Logger } from 'koishi'
import { PackageBase, PackageRegistry, PackageResult, SearchResult } from './shared'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { satisfies } from 'semver'
import { DataSource } from '@koishijs/plugin-console'
import { throttle } from 'throttle-debounce'
import spawn from 'cross-spawn'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      market: MarketProvider
    }

    interface Events {
      install(name: string): Promise<number>
    }
  }
}

type Manager = 'yarn' | 'npm' | 'pnpm'

const logger = new Logger('market')

function supports(command: string, args: string[] = []) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.on('exit', (code) => {
      resolve(code ? false : true)
    })
    child.on('error', () => {
      resolve(false)
    })
  })
}

export class MarketProvider extends DataSource<Dict<MarketProvider.Data>> {
  dataCache: Dict<MarketProvider.Data> = {}
  localCache: Dict<Promise<MarketProvider.Local>> = {}
  callbacks: ((data: MarketProvider.Data[]) => void)[] = []
  flushData: throttle<() => void>
  http: Quester
  _agentCache: Promise<Manager>

  constructor(ctx: Context, private config: MarketProvider.Config) {
    super(ctx, 'market')

    this.http = ctx.http.extend({
      endpoint: config.endpoint,
    })

    ctx.on('connect', () => this.start())

    ctx.console.addListener('install', this.install)
  }

  start() {
    const logger = this.ctx.logger('status')
    this.prepare().catch(logger.warn)
    this.flushData = throttle(100, () => this.broadcast())
  }

  stop() {
    this.flushData.cancel()
  }

  private async search(offset = 0) {
    const { objects, total } = await this.http.get<SearchResult>('/-/v1/search', {
      text: 'koishi+plugin',
      size: 250,
      from: offset,
    })
    objects.forEach(result => this.analyze(result))
    return total
  }

  private async analyze({ package: item, score }: PackageResult) {
    const { name, version } = item
    const official = name.startsWith('@koishijs/plugin-')
    const community = name.startsWith('koishi-plugin-')
    if (!official && !community) return

    const data = await this.http.get<PackageRegistry>(`/${name}`)
    const { dependencies, peerDependencies, dist, keywords, description, deprecated } = data.versions[version]
    const declaredVersion = { ...dependencies, ...peerDependencies }['koishi']
    if (deprecated || !declaredVersion || !satisfies(currentVersion, declaredVersion)) return

    const shortname = official ? name.slice(17) : name.slice(14)
    this.dataCache[name] = {
      ...item,
      shortname,
      official,
      score: score.final,
      description: description,
      keywords: keywords || [],
      size: dist.unpackedSize,
    }
    this.flushData()
  }

  async prepare() {
    const total = await this.search()
    for (let offset = 250; offset < total; offset += 250) {
      await this.search(offset)
    }
  }

  async get() {
    return this.dataCache
  }

  get cwd() {
    return this.ctx.app.options.baseDir
  }

  async getAgent(): Promise<Manager> {
    if (existsSync(resolve(this.cwd, 'yarn.lock'))) return 'yarn'
    if (existsSync(resolve(this.cwd, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(resolve(this.cwd, 'package-lock.json'))) return 'npm'
  
    const { npm_execpath } = process.env
    const isYarn = npm_execpath.includes('yarn')
    if (isYarn) return 'yarn'
  
    const hasPnpm = !isYarn && supports('pnpm', ['--version'])
    return hasPnpm ? 'pnpm' : 'npm'
  }

  install = async (name: string) => {
    const agent = await (this._agentCache ||= this.getAgent())
    await new Promise<number>((resolve) => {
      const args = [name, '--loglevel', 'error']
      if (agent === 'yarn') args.unshift('add')
      const child = spawn(agent, args, { cwd: this.cwd })
      child.on('exit', (code) => resolve(code))
      child.on('error', () => resolve(-1))
      child.stderr.on('data', (data) => {
        data = data.toString().trim()
        if (!data) return
        for (const line of data.split('\n')) {
          logger.warn(line)
        }
      })
      child.stdout.on('data', (data) => {
        data = data.toString().trim()
        if (!data) return
        for (const line of data.split('\n')) {
          logger.info(line)
        }
      })
    })
    this.sources.packages.broadcast()
  }
}

export namespace MarketProvider {
  export interface Config {
    endpoint?: string
  }

  export const Config = Schema.object({
    // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
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
    score: number
  }
}
