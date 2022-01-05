import { Context, Dict, version as currentVersion, Schema, Quester, Logger } from 'koishi'
import { Package } from './utils'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { satisfies } from 'semver'
import { DataSource } from '@koishijs/plugin-console'
import { throttle } from 'throttle-debounce'
import spawn from 'cross-spawn'

declare module '@koishijs/plugin-console' {
  interface Events {
    install(name: string): Promise<number>
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
  callbacks: ((data: MarketProvider.Data[]) => void)[] = []
  flushData: throttle<() => void>
  http: Quester
  _agentCache: Promise<Manager>

  constructor(ctx: Context, private config: MarketProvider.Config) {
    super(ctx, 'market')

    this.http = ctx.http.extend({
      endpoint: config.endpoint,
    })

    ctx.console.addListener('install', this.install)
    ctx.console.addListener('uninstall', this.uninstall)
  }

  start() {
    const logger = this.ctx.logger('status')
    this.prepare().catch(logger.warn)
    this.flushData = throttle(100, () => this.broadcast())
  }

  stop() {
    this.flushData?.cancel()
  }

  private async search(offset = 0) {
    const { objects, total } = await this.http.get<Package.SearchResult>('/-/v1/search', {
      params: {
        text: 'koishi+plugin',
        size: 250,
        from: offset,
      },
    })
    objects.forEach(result => this.analyze(result))
    return total
  }

  private async analyze({ package: item, score }: Package.SearchItem) {
    const { name, description } = item
    const official = name.startsWith('@koishijs/plugin-')
    const community = name.startsWith('koishi-plugin-')
    if (!official && !community) return

    const data = await this.http.get<Package.Registry>(`/${name}`)
    const versions = Object.values(data.versions).filter((remote) => {
      const { dependencies, peerDependencies, deprecated } = remote
      const declaredVersion = { ...dependencies, ...peerDependencies }['koishi']
      return !deprecated && declaredVersion && satisfies(currentVersion, declaredVersion)
    }).map(Package.Meta.from).reverse()
    if (!versions.length) return

    const shortname = official ? name.slice(17) : name.slice(14)
    this.dataCache[name] = {
      ...item,
      shortname,
      official,
      score: score.final,
      description,
      versions,
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
    return this.ctx.app.baseDir
  }

  async getAgent(): Promise<Manager> {
    const { npm_execpath } = process.env
    const isYarn = npm_execpath.includes('yarn')
    if (isYarn) return 'yarn'

    if (existsSync(resolve(this.cwd, 'yarn.lock'))) return 'yarn'
    if (existsSync(resolve(this.cwd, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(resolve(this.cwd, 'package-lock.json'))) return 'npm'

    const hasPnpm = !isYarn && supports('pnpm', ['--version'])
    return hasPnpm ? 'pnpm' : 'npm'
  }

  async exec(command: string, args: string[]) {
    return new Promise<number>((resolve) => {
      const child = spawn(command, args, { cwd: this.cwd })
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
  }

  install = async (name: string) => {
    const agent = await (this._agentCache ||= this.getAgent())
    await this.exec(agent, [agent === 'yarn' ? 'add' : 'install', name, '--loglevel', 'error'])
    this.ctx.console.services.packages.broadcast()
  }

  uninstall = async (name: string) => {
    const agent = await (this._agentCache ||= this.getAgent())
    await this.exec(agent, ['remove', name, '--loglevel', 'error'])
    this.ctx.console.services.packages.broadcast()
  }
}

export namespace MarketProvider {
  export interface Config {
    endpoint?: string
  }

  export const Config = Schema.object({
    // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
    endpoint: Schema.string().description('要使用的 npm registry 终结点。').default('https://registry.npmjs.org'),
  })

  export interface Data extends Package.Base {
    versions: Package.Meta[]
    shortname: string
    official: boolean
    score: number
  }
}
