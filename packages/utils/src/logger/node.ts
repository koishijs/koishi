import { inspect, InspectOptions, format } from 'util'
import { stderr } from 'supports-color'
import { Time } from '../time'
import { Dict } from '../misc'

const c16 = [6, 2, 3, 4, 5, 1]
const c256 = [
  20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62,
  63, 68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113,
  129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167, 168,
  169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200,
  201, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
]

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

export class Logger {
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
  static instances: Dict<Logger> = {}

  static formatters: Dict<(this: Logger, value: any) => string> = {
    c: Logger.prototype.color,
    C: value => Logger.color(15, value, ';1'),
    o: value => inspect(value, Logger.options).replace(/\s*\n\s*/g, ' '),
  }

  static levels: Logger.LevelConfig = {
    base: 2,
  }

  static options: InspectOptions = {
    colors: !!stderr,
  }

  static stream: NodeJS.WritableStream = process.stderr

  private code: number
  private displayName: string

  static color(code: number, value: any, decoration = '') {
    if (!stderr || !Logger.options.colors) return '' + value
    return `\u001b[3${code < 8 ? code : '8;5;' + code}${stderr.has256 ? decoration : ''}m${value}\u001b[0m`
  }

  constructor(public name: string) {
    if (name in Logger.instances) return Logger.instances[name]

    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 3) - hash) + name.charCodeAt(i)
      hash |= 0
    }
    Logger.instances[name] = this
    this.code = Logger.colors[Math.abs(hash) % Logger.colors.length]
    this.displayName = this.color(name, ';1')
    this.createMethod('success', '[S] ', Logger.SUCCESS)
    this.createMethod('error', '[E] ', Logger.ERROR)
    this.createMethod('info', '[I] ', Logger.INFO)
    this.createMethod('warn', '[W] ', Logger.WARN)
    this.createMethod('debug', '[D] ', Logger.DEBUG)
  }

  extend = (namespace: string) => {
    return new Logger(`${this.name}:${namespace}`)
  }

  createMethod(name: Logger.Type, prefix: string, minLevel: number) {
    this[name] = (...args) => {
      if (this.level < minLevel) return
      let indent = 4, output = ''
      if (Logger.showTime) {
        indent += Logger.showTime.length + 1
        output += Time.template(Logger.showTime + ' ')
      }
      output += prefix + this.displayName + ' ' + this.format(indent, ...args)
      if (Logger.showDiff) {
        const now = Date.now()
        const diff = Logger.timestamp && now - Logger.timestamp
        output += this.color(' +' + Time.formatTimeShort(diff))
        Logger.timestamp = now
      }
      Logger.stream.write(output + '\n')
    }
  }

  private format(indent: number, ...args: any[]) {
    if (args[0] instanceof Error) {
      args[0] = args[0].stack || args[0].message
    } else if (typeof args[0] !== 'string') {
      args.unshift('%O')
    }

    let index = 0
    args[0] = (args[0] as string).replace(/%([a-zA-Z%])/g, (match, format) => {
      if (match === '%%') return '%'
      index += 1
      const formatter = Logger.formatters[format]
      if (typeof formatter === 'function') {
        match = formatter.call(this, args[index])
        args.splice(index, 1)
        index -= 1
      }
      return match
    }).replace(/\n/g, '\n' + ' '.repeat(indent))

    return format(...args)
  }

  private color(value: any, decoration = '') {
    return Logger.color(this.code, value, decoration)
  }

  get level() {
    const paths = this.name.split(':')
    let config: Logger.Level = Logger.levels
    do {
      config = config[paths.shift()] ?? config['base']
    } while (paths.length && typeof config === 'object')
    return config as number
  }

  set level(value) {
    const paths = this.name.split(':')
    let config = Logger.levels
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
