import { AppOptions } from 'koishi-core'
import { WatchOptions } from 'chokidar'

export * from 'koishi-core'

export type PluginConfig = Record<string, any> | (string | [string, any?])[]

declare module 'koishi-core' {
  interface EventMap {
    'exit'(signal: NodeJS.Signals): Promise<void>
  }
}

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

export interface AppConfig extends AppOptions {
  plugins?: PluginConfig
  logLevel?: LogLevel
  logDiff?: boolean
  logTime?: string | boolean
  watch?: WatchConfig
  deamon?: DeamonConfig
}
