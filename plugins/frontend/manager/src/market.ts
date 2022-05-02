import { Context, Dict, pick, Quester, Schema } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import scan, { AnalyzedPackage, PackageJson } from '@koishijs/market'
import which from 'which-pm-runs'
import spawn from 'cross-spawn'

class MarketProvider extends DataService<Dict<MarketProvider.Data>> {
  /** https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md */
  private http: Quester
  private registry: string
  private timestamp = 0
  private fullCache: Dict<MarketProvider.Data> = {}
  private tempCache: Dict<MarketProvider.Data> = {}

  constructor(ctx: Context, public config: MarketProvider.Config) {
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
    const { registry } = this.config
    if (registry === '') {
      this.config.registry = await new Promise<string>((resolve, reject) => {
        let stdout = ''
        const agent = which()
        const key = (agent?.name === 'yarn' && !agent?.version.startsWith('1.')) ? 'npmRegistryServer' : 'registry'
        const child = spawn(agent?.name || 'npm', ['config', 'get', key], { cwd: this.ctx.app.baseDir })
        child.on('exit', (code) => {
          if (!code) return resolve(stdout)
          reject(new Error(`child process failed with code ${code}`))
        })
        child.on('error', reject)
        child.stdout.on('data', (data) => {
          stdout += data.toString()
        })
      })
    }
    this.http = this.ctx.http.extend({
      endpoint: this.config.registry.trim(),
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
  export interface Config {
    registry?: string
  }

  export const Config = Schema.object({
    registry: Schema.string().description('用于插件市场搜索和下载的 registry，需要支持搜索功能').default(''),
  }).description('插件市场设置')

  export interface Data extends Omit<AnalyzedPackage, 'versions'> {
    versions: Partial<PackageJson>[]
  }
}

export default MarketProvider
