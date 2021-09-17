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

export interface DeamonConfig {
  exitCommand?: boolean | string
  autoRestart?: boolean
}

declare module 'koishi' {
  namespace App {
    interface Config extends DeamonConfig {
      allowWrite?: boolean
      plugins?: PluginConfig
      logLevel?: LogLevel
      logDiff?: boolean
      logTime?: string | boolean
      watch?: WatchConfig
      timezoneOffset?: number
      stackTraceLimit?: number
    }
  }

  interface EventMap {
    'exit'(signal: NodeJS.Signals): Promise<void>
    'config/install'(name: string, config: any): void
    'config/reload'(name: string, config: any): void
    'config/dispose'(name: string, config: any): void
    'config/save'(name: string, config: any): void
  }
}

export * from 'koishi'

export function defineConfig(config: App.Config): App.Config
