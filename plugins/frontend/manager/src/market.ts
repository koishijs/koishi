import { Context, Dict, version as currentVersion, Schema, Quester, Logger } from 'koishi'
import { Package } from './utils'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { satisfies } from 'semver'
import { DataService } from '@koishijs/plugin-console'
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

class MarketProvider extends DataService<Dict<MarketProvider.Data>> {
  private http: Quester
  private timestamp = 0
  private agentTask: Promise<Manager>
  private fullCache: Dict<MarketProvider.Data> = {}
  private tempCache: Dict<MarketProvider.Data> = {}

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
  }

  flushData() {
    const now = Date.now()
    if (now - this.timestamp < 100) return
    this.timestamp = now
    this.patch(this.tempCache)
    this.tempCache = {}
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

    const registry = await this.http.get<Package.Registry>(`/${name}`)
    const versions = Object.values(registry.versions).filter((remote) => {
      const { dependencies, peerDependencies, deprecated } = remote
      const declaredVersion = { ...dependencies, ...peerDependencies }['koishi']
      return !deprecated && declaredVersion && satisfies(currentVersion, declaredVersion)
    }).map(Package.Meta.from).reverse()
    if (!versions.length) return

    const shortname = official ? name.slice(17) : name.slice(14)
    this.tempCache[name] = this.fullCache[name] = {
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
    return this.fullCache
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
    const agent = await (this.agentTask ||= this.getAgent())
    await this.exec(agent, [agent === 'yarn' ? 'add' : 'install', name, '--loglevel', 'error'])
    this.ctx.console.packages.refresh()
  }

  uninstall = async (name: string) => {
    const agent = await (this.agentTask ||= this.getAgent())
    await this.exec(agent, ['remove', name, '--loglevel', 'error'])
    this.ctx.console.packages.refresh()
  }
}

namespace MarketProvider {
  export interface Config {
    endpoint?: string
  }

  export const Config = Schema.object({
    // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
    endpoint: Schema.string().role('url').description('要使用的 npm registry 终结点。').default('https://registry.npmjs.org'),
  })

  export interface Data extends Package.Base {
    versions: Package.Meta[]
    shortname: string
    official: boolean
    score: number
  }
}

export default MarketProvider
