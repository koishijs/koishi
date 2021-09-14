import { App, Plugin, Dict, camelize, Loader } from 'koishi'
import { WatchOptions } from 'chokidar'

export type PluginConfig = {
  [K in keyof Loader as camelize<K>]?: Loader[K] extends Plugin<infer T> ? T : never
} & Dict<unknown>

interface LogLevelConfig {
  // a little different from koishi-utils
  // we don't enforce user to provide a base here
  base?: number
  [K: string]: LogLevel
}

type LogLevel = number | LogLevelConfig

export interface WatchConfig extends WatchOptions {
  root?: string
  fullReload?: boolean
}

interface DeamonConfig {
  exitCommand?: boolean | string
  autoRestart?: boolean
}

export interface AppConfig extends App.Config {
  plugins?: PluginConfig
  logLevel?: LogLevel
  logDiff?: boolean
  logTime?: string | boolean
  watch?: WatchConfig
  deamon?: DeamonConfig
  proxyAgent?: string
  timezoneOffset?: number
  stackTraceLimit?: number
}

export * from 'koishi'

export function defineConfig(config: AppConfig): AppConfig
