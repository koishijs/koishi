import { App, Schema } from 'koishi'

export interface AdapterConfig extends App.Config.Request {
  path?: string
  selfUrl?: string
}

export const AdapterConfig: Schema<AdapterConfig> = Schema.object({
  path: Schema.string().description('服务器监听的路径。').default('/telegram'),
  selfUrl: Schema.string().description('Koishi 服务暴露在公网的地址。缺省时将使用全局配置。'),
})
