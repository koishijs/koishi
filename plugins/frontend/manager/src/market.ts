import { Context, version as currentVersion, Dict, Quester, Schema } from 'koishi'
import { Package } from './utils'
import { satisfies } from 'semver'
import { DataService } from '@koishijs/plugin-console'
import spawn from 'cross-spawn'

class MarketProvider extends DataService<Dict<MarketProvider.Data>> {
  /** https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md */
  private http: Quester
  private timestamp = 0
  private fullCache: Dict<MarketProvider.Data> = {}
  private tempCache: Dict<MarketProvider.Data> = {}

  constructor(ctx: Context, private config: MarketProvider.Config) {
    super(ctx, 'market', { authority: 4 })
  }

  async start() {
    const logger = this.ctx.logger('market')
    await this.prepare().catch(logger.warn)
    this.refresh()
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
    }).map(Package.getMeta).reverse()
    if (!versions.length) return

    const shortname = official ? name.slice(17) : name.slice(14)
    const latest = registry.versions[versions[0].version]
    this.tempCache[name] = this.fullCache[name] = {
      ...item,
      shortname,
      official,
      score: score.detail.popularity * 100,
      description,
      versions,
      size: latest.dist.unpackedSize,
      license: latest.license,
    }
    this.flushData()
  }

  async prepare() {
    const registry = await new Promise<string>((resolve, reject) => {
      let stdout = ''
      const child = spawn('npm', ['config', 'get', 'registry'], { cwd: this.ctx.app.baseDir })
      child.on('exit', (code) => {
        if (!code) return resolve(stdout)
        reject(new Error(`child process failed with code ${code}`))
      })
      child.on('error', reject)
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
    })
    this.http = this.ctx.http.extend({
      endpoint: registry.trim(),
    })

    const total = await this.search()
    for (let offset = 250; offset < total; offset += 250) {
      await this.search(offset)
    }
  }

  async get() {
    return this.fullCache
  }
}

namespace MarketProvider {
  export interface Config {}

  export const Config = Schema.object({})

  export interface Data extends Package.SearchPackage {
    versions: Package.Meta[]
    shortname: string
    official: boolean
    score: number
    size: number
    license: string
  }
}

export default MarketProvider
