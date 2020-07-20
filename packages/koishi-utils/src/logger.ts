import { stderr } from 'supports-color'
import * as tty from 'tty'
import * as util from 'util'

const isTTY = tty.isatty(process.stderr['fd'])

export const inspectOptions: util.InspectOptions = {
  colors: isTTY,
}

const colors = stderr.level >= 2 ? [6, 2, 3, 4, 5, 1] : [
  20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62,
  63, 68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113,
  129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167, 168,
  169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200,
  201, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
]

export const formatters: Record<string, (value: any) => string> = {
  o: value => util.inspect(value, inspectOptions).replace(/\s*\n\s*/g, ' '),
  O: value => util.inspect(value, inspectOptions),
}

function pickColor (namespace: string): number | string {
  let hash = 0
  for (let i = 0; i < namespace.length; i++) {
    hash = ((hash << 5) - hash) + namespace.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

const instances: Record<string, Logger> = {}

export class Logger {
  static baseLevel = 2
  static levels: Record<string, number> = {}

  static create (name = '') {
    return instances[name] || new Logger(name)
  }

  color = pickColor(this.name)

  private constructor (private name: string) {
    instances[this.name] = this
  }

  get level () {
    return Logger.levels[this.name] ?? Logger.baseLevel
  }

  extend = (namespace: string) => {
    return Logger.create(`${this.name}:${namespace}`)
  }

  success = (format: any, ...param: any[]) => {
    if (this.level < 1) return
    return this.log('[S] ', format, ...param)
  }

  error = (format: any, ...param: any[]) => {
    if (this.level < 1) return
    return this.log('[E] ', format, ...param)
  }

  info = (format: any, ...param: any[]) => {
    if (this.level < 2) return
    return this.log('[I] ', format, ...param)
  }

  warn = (format: any, ...param: any[]) => {
    if (this.level < 2) return
    return this.log('[W] ', format, ...param)
  }

  debug = (format: any, ...param: any[]) => {
    if (this.level < 3) return
    return this.log('[D] ', format, ...param)
  }

  private log (prefix: string, format: any, ...param: any[]): void
  private log (prefix: string, ...args: [any, ...any[]]) {
    if (args[0] instanceof Error) {
      args[0] = args[0].stack || args[0].message
    } else if (typeof args[0] !== 'string') {
      args.unshift('%O')
    }

    let index = 0
    args[0] = (args[0] as string).replace(/%([a-zA-Z%])/g, (match, format) => {
      if (match === '%%') return match
      index += 1
      const formatter = formatters[format]
      if (typeof formatter === 'function') {
        match = formatter(args[index])
        args.splice(index, 1)
        index -= 1
      }
      return match
    })

    const name = this.name ? this.name + ' ' : ''
    if (isTTY) {
      const code = '\u001B[3' + (this.color < 8 ? this.color : '8;5;' + this.color)
      args[0] = `${prefix}${code};1m${name}\u001B[0m${args[0]}`
    } else {
      args[0] = `${prefix}${name}${args[0]}`
    }

    return process.stderr.write(util.format(...args) + '\n')
  }
}
