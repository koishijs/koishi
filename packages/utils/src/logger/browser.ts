import { Time } from '../time'
import { Logger } from './base'

class BrowserLogger extends Logger {
  extend = (namespace: string) => {
    return new BrowserLogger(`${this.name}:${namespace}`)
  }

  createMethod(name: Logger.Type, prefix: string, minLevel: number) {
    this[name] = (...args) => {
      if (this.level < minLevel) return
      let output: string[] = []
      if (Logger.showTime) {
        output.push(Time.template(Logger.showTime))
      }
      output.push(prefix + this.displayName, ...args)
      if (Logger.showDiff) {
        const now = Date.now()
        const diff = Logger.timestamp && now - Logger.timestamp
        output.push(this.color('+' + Time.formatTimeShort(diff)))
        Logger.timestamp = now
      }
      console[name === 'debug' ? 'debug' : 'log'](...output)
    }
  }
}

export { BrowserLogger as Logger }
