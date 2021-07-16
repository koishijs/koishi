import { stderr } from 'supports-color'

const c16 = [6, 2, 3, 4, 5, 1]
const c256 = [
  20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62,
  63, 68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113,
  129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167, 168,
  169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200,
  201, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
]

export namespace BaseLogger {
  export interface LevelConfig {
    base: number
    [K: string]: Level
  }
  
  export type Level = number | LevelConfig
  export type Function = (format: any, ...param: any[]) => void
  export type Type = 'success' | 'error' | 'info' | 'warn' | 'debug'
}

export interface BaseLogger extends Record<BaseLogger.Type, BaseLogger.Function> {
}

export abstract class BaseLogger {
  // log levels
  static readonly SILENT = 0
  static readonly SUCCESS = 1
  static readonly ERROR = 1
  static readonly INFO = 2
  static readonly WARN = 2
  static readonly DEBUG = 3

  // global config
  static showDiff = false
  static showTime = ''
  static timestamp = 0

  // global registry
  static colors = stderr ? stderr.has256 ? c256 : c16 : []
  static instances: Record<string, BaseLogger> = {}

  static formatters: Record<string, (this: BaseLogger, value: any) => string> = {
    c: BaseLogger.prototype.color,
    C: value => BaseLogger.color(15, value, ';1'),
  }

  static levels: BaseLogger.LevelConfig = {
    base: 2,
  }

  protected code: number
  protected displayName: string

  protected abstract createMethod(name: BaseLogger.Type, prefix: string, minLevel: number): void
  abstract extend: (namespace: string) => BaseLogger

  static color(code: number, value: any, decoration = '') {
    if (!stderr) return '' + value
    return `\u001b[3${code < 8 ? code : '8;5;' + code}${stderr.has256 ? decoration : ''}m${value}\u001b[0m`
  }

  constructor(public name: string) {
    if (name in BaseLogger.instances) return BaseLogger.instances[name]

    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 3) - hash) + name.charCodeAt(i)
      hash |= 0
    }
    BaseLogger.instances[name] = this
    this.code = BaseLogger.colors[Math.abs(hash) % BaseLogger.colors.length]
    this.displayName = this.color(name, ';1')
    this.createMethod('success', '[S] ', BaseLogger.SUCCESS)
    this.createMethod('error', '[E] ', BaseLogger.ERROR)
    this.createMethod('info', '[I] ', BaseLogger.INFO)
    this.createMethod('warn', '[W] ', BaseLogger.WARN)
    this.createMethod('debug', '[D] ', BaseLogger.DEBUG)
  }

  protected color(value: any, decoration = '') {
    return BaseLogger.color(this.code, value, decoration)
  }

  get level() {
    const paths = this.name.split(':')
    let config: BaseLogger.Level = BaseLogger.levels
    do {
      config = config[paths.shift()] ?? config['base']
    } while (paths.length && typeof config === 'object')
    return config as number
  }

  set level(value) {
    const paths = this.name.split(':')
    let config = BaseLogger.levels
    while (paths.length > 1) {
      const name = paths.shift()
      const value = config[name]
      if (typeof value === 'object') {
        config = value
      } else {
        config = config[name] = { base: value ?? config.base }
      }
    }
    config[paths[0]] = value
  }
}
