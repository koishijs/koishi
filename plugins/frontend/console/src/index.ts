import { Context, Schema, Service } from 'koishi'
import HttpService, { Entry } from './http'
import WsService from './socket'
import { DataService } from './service'

export * from './service'
export * from './http'
export * from './socket'

type NestedServices = {
  [K in keyof Console.Services as `console.${K}`]: Console.Services[K]
}

declare module 'koishi' {
  interface Context extends NestedServices {
    console: Console
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

    const { devMode, uiPath, apiPath, selfUrl } = config
    this.global.devMode = devMode
    this.global.uiPath = uiPath
    this.global.endpoint = selfUrl + apiPath

    ctx.plugin(HttpService, config)
    ctx.plugin(WsService, config)
  }

  addEntry(filename: string | Entry) {
    this.http.addEntry(filename)
  }

  addListener<K extends keyof Events>(event: K, callback: Events[K], options?: DataService.Options) {
    this.ws.addListener(event, { callback, ...options })
  }
}

export interface Events {}

export namespace Console {
  export interface Config extends HttpService.Config, WsService.Config {}

  export const Config: Schema<Config> = Schema.object({
    uiPath: Schema
      .string()
      .description('前端页面呈现的路径。')
      .default(''),
    apiPath: Schema
      .string()
      .description('后端 API 服务的路径。')
      .default('/status'),
    selfUrl: Schema
      .string()
      .description('Koishi 服务暴露在公网的地址。')
      .role('url')
      .default(''),
    open: Schema
      .boolean()
      .description('在应用启动后自动在浏览器中打开控制台。'),
    devMode: Schema
      .boolean()
      .description('启用调试模式（仅供开发者使用）。')
      .default(process.env.NODE_ENV === 'development')
      .hidden(),
  })

  export interface Services {
    http?: HttpService
    ws?: WsService
  }
}

export default Console
