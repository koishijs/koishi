import { inspect, InspectOptions, format } from 'util'
import { formatTimeShort } from './date'
import { stderr } from 'supports-color'

const colors = stderr.level < 2 ? [6, 2, 3, 4, 5, 1] : [
  20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62,
  63, 68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113,
  129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167, 168,
  169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200,
  201, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
]

const instances: Record<string, Logger> = {}

type LogFunction = (format: any, ...param: any[]) => void

export class Logger {
  static baseLevel = 2
  static showDiff = false
  static levels: Record<string, number> = {}
  static lastTime = 0

  static options: InspectOptions = {
    colors: stderr.hasBasic,
  }

  static formatters: Record<string, (this: Logger, value: any) => string> = {
    c: Logger.prototype.color,
    C: value => Logger.color(15, value, ';1'),
    o: value => inspect(value, Logger.options).replace(/\s*\n\s*/g, ' '),
  }

  static create (name = '', showDiff = false) {
    const logger = instances[name] || new Logger(name)
    if (showDiff !== undefined) logger.showDiff = showDiff
    return logger
  }

  static color (code: number, value: any, decoration = '') {
    if (!Logger.options.colors) return '' + value
    return `\u001B[3${code < 8 ? code : '8;5;' + code}${decoration}m${value}\u001B[0m`
  }

  private code: number
  private displayName: string

  public success: LogFunction
  public error: LogFunction
  public info: LogFunction
  public warn: LogFunction
  public debug: LogFunction

  private constructor (private name: string, private showDiff = false) {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 3) - hash) + name.charCodeAt(i)
      hash |= 0
    }
    instances[name] = this
    this.code = colors[Math.abs(hash) % colors.length]
    this.displayName = name ? this.color(name + ' ', ';1') : ''
    this.createMethod('success', '[S] ', 1)
    this.createMethod('error', '[E] ', 1)
    this.createMethod('info', '[I] ', 2)
    this.createMethod('warn', '[W] ', 2)
    this.createMethod('debug', '[D] ', 3)
  }

  private color (value: any, decoration = '') {
    return Logger.color(this.code, value, decoration)
  }

  private createMethod (name: string, prefix: string, minLevel: number) {
    this[name] = (...args: [any, ...any[]]) => {
      if (this.level < minLevel) return
      process.stderr.write(prefix + this.displayName + this.format(...args) + '\n')
    }
  }

  get level () {
    return Logger.levels[this.name] ?? Logger.baseLevel
  }

  extend = (namespace: string) => {
    return Logger.create(`${this.name}:${namespace}`)
  }

  format: (format: any, ...param: any[]) => string = (...args) => {
    if (args[0] instanceof Error) {
      args[0] = args[0].stack || args[0].message
    } else if (typeof args[0] !== 'string') {
      args.unshift('%O')
    }

    let index = 0
    args[0] = (args[0] as string).replace(/%([a-zA-Z%])/g, (match, format) => {
      if (match === '%%') return match
      index += 1
      const formatter = Logger.formatters[format]
      if (typeof formatter === 'function') {
        match = formatter.call(this, args[index])
        args.splice(index, 1)
        index -= 1
      }
      return match
    }).split('\n').join('\n    ')

    if (Logger.showDiff || this.showDiff) {
      const now = Date.now()
      if (Logger.lastTime) {
        args.push(this.color('+' + formatTimeShort(now - Logger.lastTime)))
      }
      Logger.lastTime = now
    }

    return format(...args)
  }
}
