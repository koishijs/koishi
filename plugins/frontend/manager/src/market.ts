import { Context, Dict, pick, Quester, Schema } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import scan, { AnalyzedPackage, PackageJson } from '@koishijs/market'
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

    await scan({
      version: '4',
      request: this.http.get,
      onItem: (item) => {
        const { name, versions } = item
        this.tempCache[name] = this.fullCache[name] = {
          ...item,
          versions: versions.map(item => pick(item, ['version', 'keywords', 'peerDependencies'])),
        }
        this.flushData()
      },
    })
  }

  async get() {
    return this.fullCache
  }
}

namespace MarketProvider {
  export interface Config {}

  export const Config = Schema.object({})

  export interface Data extends Omit<AnalyzedPackage, 'versions'> {
    versions: Partial<PackageJson>[]
  }
}

export default MarketProvider
