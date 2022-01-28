import { Context, Schema, Service } from 'koishi'
import HttpService from './http'
import WsService, { Listener } from './ws'

export * from './service'
export * from './http'
export * from './ws'

type NestedServices = {
  [K in keyof Console.Services as `console.${K}`]: Console.Services[K]
}

declare module 'koishi' {
  namespace Context {
    interface Services extends NestedServices {
      console: Console
    }
  }
}

export interface ClientConfig {
  devMode: boolean
  uiPath: string
  endpoint: string
}

export interface Console extends Console.Services {}

export class Console extends Service {
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

export interface Events {}

export namespace Console {
  export interface Config extends HttpService.Config, WsService.Config {}

  export const Config = Schema.object({
    uiPath: Schema.string().description('前端页面呈现的路径。').default(''),
    apiPath: Schema.string().description('后端 API 服务的路径。').default('/status'),
    selfUrl: Schema.string().description('Koishi 服务暴露在公网的地址。').comment('与其他需要 selfUrl 配置项的地方不同的是，这里的属性不会继承 app.options.selfUrl 的值。这是因为，由于这里缺省时会使用相对路径，网页依旧可以正常访问。只有你将 uiPath 和 apiPath 分别部署到了不同的端口或域名时，这个选项才建议使用。').default(''),
    open: Schema.boolean().description('在应用启动后自动在浏览器中打开控制台。'),
    devMode: Schema.boolean().description('启用调试模式（仅供开发者使用）。'),
  })

  export interface Services {
    http?: HttpService
    ws?: WsService
  }
}

export default Console
