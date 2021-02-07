import { AppOptions } from 'koishi-core'

export * from 'koishi-core'

export type PluginConfig = Record<string, any> | (string | [string, any?])[]

export interface AppConfig extends AppOptions {
  plugins?: PluginConfig
  logLevel?: number
  logFilter?: Record<string, number>
}
