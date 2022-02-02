import { Context, Dict, version as currentVersion, Schema, Quester } from 'koishi'
import { Package } from './utils'
import { satisfies } from 'semver'
import { DataService } from '@koishijs/plugin-console'

class MarketProvider extends DataService<Dict<MarketProvider.Data>> {
  private http: Quester
  private timestamp = 0
  private fullCache: Dict<MarketProvider.Data> = {}
  private tempCache: Dict<MarketProvider.Data> = {}

  constructor(ctx: Context, private config: MarketProvider.Config) {
    super(ctx, 'market')

    this.http = ctx.http.extend({
      endpoint: config.endpoint,
    })
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
      score: score.detail.popularity * 100,
      description,
      versions,
      readme: registry.readme,
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
    readme: string
  }
}

export default MarketProvider
