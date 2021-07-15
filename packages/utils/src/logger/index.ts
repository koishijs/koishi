import { inspect, InspectOptions, format } from 'util'
import { stderr } from 'supports-color'
import { Logger } from './base'
import { Time } from '../time'

Logger.formatters.o = value => inspect(value, NodeLogger.options).replace(/\s*\n\s*/g, ' ')

class NodeLogger extends Logger {
  static options: InspectOptions = {
    colors: !!stderr,
  }

  static stream: NodeJS.WritableStream = process.stderr

  extend = (namespace: string) => {
    return new NodeLogger(`${this.name}:${namespace}`)
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
      NodeLogger.stream.write(output + '\n')
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
}

export { NodeLogger as Logger }
