export namespace Logger {
  export interface LevelConfig {
    base: number
    [K: string]: Level
  }

  export type Level = number | LevelConfig
  export type Function = (format: any, ...param: any[]) => void
  export type Type = 'success' | 'error' | 'info' | 'warn' | 'debug'
  export type Formatter = (this: Logger, value: any) => string

  export interface Target {
    showDiff?: boolean
    showTime: string
    print(text: string): void
  }
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
  static timestamp: number
  static colors: number[]
  static instances: Record<string, Logger>
  static targets: Logger.Target[]
  static levels: Logger.LevelConfig
  static formatters: Record<string, Logger.Formatter>

  private code: number
  private displayName: string

  static color(code: number, value: any, decoration?: string): string

  public name: string
  public level: number

  constructor(name: string)

  extend(namespace: string): Logger
}
