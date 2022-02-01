import { Schema } from 'koishi'

export interface AdapterConfig {
  path?: string
  selfUrl?: string
}

export const AdapterConfig: Schema<AdapterConfig> = Schema.object({
  path: Schema.string().description('服务器监听的路径。').default('/telegram'),
  selfUrl: Schema.string().role('url').description('Koishi 服务暴露在公网的地址。缺省时将使用全局配置。'),
})
