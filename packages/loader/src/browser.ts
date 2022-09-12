import { Context } from 'koishi'
import { Loader, unwrapExports } from './shared'
import { MarketResult, SearchResult } from '@koishijs/registry'

export * from './shared'

function resolveName(name: string) {
  if (name[0] === '@') {
    const [left, right] = name.split('/')
    return [`${left}/koishi-plugin-${right}`]
  } else {
    return [`@koishijs/plugin-${name}`, `koishi-plugin-${name}`]
  }
}

export default class BrowserLoader extends Loader {
  public extname: string
  public meta = Object.create(null)
  public config = { plugins: {} }
  private _initTask: Promise<void>

  constructor(public baseDir: string) {
    super()
  }

  private async prepare() {
    if (!process.env.KOISHI_BASE) return
    const [search, market]: [SearchResult, MarketResult] = await Promise.all([
      fetch(this.baseDir + '/index.json').then(res => res.json()),
      fetch(this.baseDir + '/market.json').then(res => res.json()),
    ])
    for (const object of search.objects) {
      if (!object.portable) continue
      const { name } = object.package
      const shortname = name.replace(/(koishi-|^@koishijs\/)plugin-/, '')
      const item = market.objects.find(item => item.name === name)
      this.cache[shortname] = `${this.baseDir}/modules/${name}/index.js`
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
    const urls = process.env.KOISHI_BASE
      ? [this.cache[name]]
      : resolveName(name).map(name => `${this.baseDir}/modules/${name}/index.js`)
    for (const url of urls) {
      try {
        return unwrapExports(await import(/* @vite-ignore */ url))
      } catch (err) {}
    }
    console.error(`cannot resolve plugin ${name}`)
  }

  fullReload() {
    console.info('trigger full reload')
  }
}
