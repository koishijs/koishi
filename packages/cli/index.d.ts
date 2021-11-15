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
      watch?: WatchConfig
      logger?: LoggerConfig
      timezoneOffset?: number
      stackTraceLimit?: number
    }

    namespace Config {
      export interface Logger {
        levels?: LogLevel
        showDiff?: boolean
        showTime?: string | boolean
      }
    }
  }

  interface EventMap {
    'exit'(signal: NodeJS.Signals): Promise<void>
    'config/plugin-install'(name: string, config: any): void
    'config/plugin-reload'(name: string, config: any): void
    'config/plugin-dispose'(name: string, config: any): void
    'config/plugin-save'(name: string, config: any): void
    'config/bot-create'(platform: string, config: any): void
    'config/bot-remove'(id: string): void
    'config/bot-start'(id: string): void
    'config/bot-stop'(id: string): void
    'logger/read'(date?: string): Promise<string[]>
    'logger/data'(text: string): void
  }
}

export * from 'koishi'

export function defineConfig(config: App.Config): App.Config
