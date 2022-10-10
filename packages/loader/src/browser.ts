import { makeArray } from 'koishi'
import { Loader, unwrapExports } from './shared'
import { MarketResult } from '@koishijs/registry'

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
  public config = { plugins: {} }
  private _initTask: Promise<void>

  constructor() {
    super()
  }

  private async prepare() {
    if (!process.env.KOISHI_REGISTRY) return
    const market: MarketResult = await fetch(process.env.KOISHI_REGISTRY + '/market.json').then(res => res.json())
    for (const object of market.objects) {
      this.cache[object.shortname] = `${process.env.KOISHI_REGISTRY}/modules/${object.name}/index.js`
    }
  }

  readConfig() {
    return null
  }

  writeConfig() {
    this.app.emit('config')
  }

  async resolvePlugin(name: string) {
    await (this._initTask ||= this.prepare())
    const urls = process.env.KOISHI_REGISTRY
      ? makeArray(this.cache[name])
      : resolveName(name).map(name => `/modules/${name}/index.js`)
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
