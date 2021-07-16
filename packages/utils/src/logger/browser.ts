import { Time } from '../time'
import { BaseLogger } from './base'

export class Logger extends BaseLogger {
  extend = (namespace: string) => {
    return new Logger(`${this.name}:${namespace}`)
  }

  createMethod(name: BaseLogger.Type, prefix: string, minLevel: number) {
    this[name] = (...args) => {
      if (this.level < minLevel) return
      let output: string[] = []
      if (BaseLogger.showTime) {
        output.push(Time.template(BaseLogger.showTime))
      }
      output.push(prefix + this.displayName, ...args)
      if (BaseLogger.showDiff) {
        const now = Date.now()
        const diff = BaseLogger.timestamp && now - BaseLogger.timestamp
        output.push(this.color('+' + Time.formatTimeShort(diff)))
        BaseLogger.timestamp = now
      }
      console[name === 'debug' ? 'debug' : 'log'](...output)
    }
  }
}
