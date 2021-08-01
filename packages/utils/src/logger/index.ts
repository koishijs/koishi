export namespace Logger {
  export interface LevelConfig {
    base: number
    [K: string]: Level
  }

  export type Level = number | LevelConfig
  export type Function = (format: any, ...param: any[]) => void
  export type Type = 'success' | 'error' | 'info' | 'warn' | 'debug'
}

export interface Logger extends Record<Logger.Type, Logger.Function> {
}

export declare class Logger {
  // log levels
  static readonly SILENT = 0
  static readonly SUCCESS = 1
  static readonly ERROR = 1
  static readonly INFO = 2
  static readonly WARN = 2
  static readonly DEBUG = 3

  // global config
  static showDiff: boolean
  static showTime: string
  static timestamp: number

  // global registry
  static colors: number[]
  static instances: Record<string, Logger>
  static levels: Logger.LevelConfig

  private code: number
  private displayName: string

  static color(code: number, value: any, decoration?: string): string

  public name: string
  public level: number

  constructor(name: string)

  extend(namespace: string): Logger
}
