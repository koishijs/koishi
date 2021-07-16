import { inspect, InspectOptions, format } from 'util'
import { stderr } from 'supports-color'
import { BaseLogger } from './base'
import { Time } from '../time'

BaseLogger.formatters.o = value => inspect(value, Logger.options).replace(/\s*\n\s*/g, ' ')

export class Logger extends BaseLogger {
  static options: InspectOptions = {
    colors: !!stderr,
  }

  static stream: NodeJS.WritableStream = process.stderr

  extend = (namespace: string) => {
    return new Logger(`${this.name}:${namespace}`)
  }

  createMethod(name: BaseLogger.Type, prefix: string, minLevel: number) {
    this[name] = (...args) => {
      if (this.level < minLevel) return
      let indent = 4, output = ''
      if (BaseLogger.showTime) {
        indent += BaseLogger.showTime.length + 1
        output += Time.template(BaseLogger.showTime + ' ')
      }
      output += prefix + this.displayName + ' ' + this.format(indent, ...args)
      if (BaseLogger.showDiff) {
        const now = Date.now()
        const diff = BaseLogger.timestamp && now - BaseLogger.timestamp
        output += this.color(' +' + Time.formatTimeShort(diff))
        BaseLogger.timestamp = now
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
      const formatter = BaseLogger.formatters[format]
      if (typeof formatter === 'function') {
        match = formatter.call(this, args[index])
        args.splice(index, 1)
        index -= 1
      }
      return match
    }).replace(/\n/g, '\n' + ' '.repeat(indent))

    return format(...args)
  }
}
