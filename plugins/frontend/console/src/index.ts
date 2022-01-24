import { Context, Schema, Service } from 'koishi'
import HttpService from './http'
import WsService, { Listener } from './ws'

type SubServices = {
  [K in keyof Sources as `console.${K}`]: Sources[K]
}

declare module 'koishi' {
  namespace Context {
    interface Services extends SubServices {
      console: Console
    }
  }
}

export interface ClientConfig {
  devMode: boolean
  uiPath: string
  endpoint: string
}

interface Console extends Sources {}

class Console extends Service {
  public global = {} as ClientConfig

  constructor(public ctx: Context, public config: Console.Config) {
    super(ctx, 'console', true)

    ctx.plugin(HttpService, config)
    ctx.plugin(WsService, config)
  }

  addEntry(filename: string) {
    this.http.addEntry(filename)
  }

  addListener<K extends keyof Events>(event: K, callback: Events[K]): void
  addListener(event: string, callback: Listener): void
  addListener(event: string, callback: Listener) {
    this.ws.addListener(event, callback)
  }
}

export interface Sources {
  http?: HttpService
  ws?: WsService
}

export interface Events {}

namespace Console {
  export interface Config extends HttpService.Config, WsService.Config {}

  export const Config = Schema.object({
    uiPath: Schema.string().description('前端页面呈现的路径。').default(''),
    apiPath: Schema.string().description('后端 API 服务的路径。').default('/status'),
    selfUrl: Schema.string().description('Koishi 服务暴露在公网的地址。').comment('与其他需要 selfUrl 配置项的地方不同的是，这里的属性不会继承 app.options.selfUrl 的值。这是因为，由于这里缺省时会使用相对路径，网页依旧可以正常访问。只有你将 uiPath 和 apiPath 分别部署到了不同的端口或域名时，这个选项才建议使用。').default(''),
    open: Schema.boolean().description('在应用启动后自动在浏览器中打开控制台。'),
    devMode: Schema.boolean().description('启用调试模式（仅供开发者使用）。'),
  })
}

export default Console
