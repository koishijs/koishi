import { Context } from 'koishi'
import { Console } from './server'

export abstract class DataSource<T = any> {
  abstract get(forced?: boolean): Promise<T>

  constructor(protected ctx: Context, protected type: keyof Console.Sources) {
    this.sources[type] = this as never

    ctx.on('disconnect', () => {
      delete this.sources[type]
    })
  }

  get sources() {
    return this.ctx.console.sources
  }

  async broadcast(value?: T) {
    this.ctx.console.broadcast('data', {
      key: this.type,
      value: value || await this.get(true),
    })
  }
}
