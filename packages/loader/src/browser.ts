import { Context } from 'koishi'
import { Loader, unwrapExports } from './shared'
import { MarketResult, SearchResult } from '@koishijs/registry'

export default class BrowserLoader extends Loader {
  public extname: string
  public meta = Object.create(null)
  public config = { plugins: {} }
  private _initTask: Promise<void>

  constructor(public baseDir: string) {
    super()
  }

  private async prepare() {
    const [search, market]: [SearchResult, MarketResult] = await Promise.all([
      fetch(this.baseDir + '/index.json').then(res => res.json()),
      fetch(this.baseDir + '/market.json').then(res => res.json()),
    ])
    for (const object of search.objects) {
      if (!object.portable) continue
      const { name } = object.package
      const shortname = name.replace(/(koishi-|^@koishijs\/)plugin-/, '')
      const item = market.objects.find(item => item.name === name)
      this.cache[shortname] = `${this.baseDir}/modules/${name}@${item.version}/index.js`
      this.meta[shortname] = item.versions[item.version]
    }
  }

  readConfig() {
    return new Context.Config()
  }

  writeConfig() {
  }

  async resolvePlugin(name: string) {
    await (this._initTask ||= this.prepare())
    try {
      return unwrapExports(await import(this.cache[name]))
    } catch (err) {
      console.error(err)
    }
  }

  async getPluginMeta(name: string) {
    await (this._initTask ||= this.prepare())
    return this.meta[name]
  }

  fullReload() {
    console.info('trigger full reload')
  }
}
