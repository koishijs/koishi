import { Context, Dict, pick, Quester, Schema } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import scan, { AnalyzedPackage, PackageJson, Registry } from '@koishijs/registry'
import which from 'which-pm-runs'
import spawn from 'cross-spawn'
import { loadManifest } from './utils'

class MarketProvider extends DataService<Dict<MarketProvider.Data>> {
  /** https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md */
  private http: Quester
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
    const cwd = this.ctx.app.baseDir
    let { registry } = this.config
    if (!registry) {
      registry = await new Promise<string>((resolve, reject) => {
        let stdout = ''
        const agent = which()
        const key = (agent?.name === 'yarn' && !agent?.version.startsWith('1.')) ? 'npmRegistryServer' : 'registry'
        const child = spawn(agent?.name || 'npm', ['config', 'get', key], { cwd })
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
      endpoint: registry.trim(),
    })

    const meta = loadManifest(cwd)
    const tasks = Object.keys(meta.dependencies).map(async (name) => {
      const registry = await this.http.get<Registry>(`/${name}`)
      const versions = Object.values(registry.versions)
        .map(item => pick(item, ['version', 'peerDependencies']))
        .reverse()
      this.tempCache[name] = this.fullCache[name] = { versions } as any
      this.flushData()
    })

    tasks.push(scan({
      version: '4',
      request: this.http.get,
      onSuccess: (item) => {
        const { name, versions } = item
        this.tempCache[name] = this.fullCache[name] = {
          ...item,
          versions: versions.map(item => pick(item, ['version', 'keywords', 'peerDependencies'])),
        }
        this.flushData()
      },
    }))

    await Promise.allSettled(tasks)
  }

  async get() {
    return this.fullCache
  }
}

namespace MarketProvider {
  export interface Config {
    registry?: string
  }

  export const Config: Schema<Config> = Schema.object({
    registry: Schema.string().description('用于插件市场搜索和下载的 registry。').default(''),
  }).description('插件市场设置')

  export interface Data extends Omit<AnalyzedPackage, 'versions'> {
    versions: Partial<PackageJson>[]
  }
}

export default MarketProvider
