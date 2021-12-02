import { Context } from 'koishi'
import { Console } from './server'

export abstract class DataSource<T = any> {
  abstract get(forced?: boolean): Promise<T>

  constructor(protected ctx: Context, protected name: keyof Console.Services) {
    ctx.console.services[name] = this as never

    ctx.on('disconnect', () => {
      delete ctx.console.services[name]
    })
  }

  async broadcast(value?: T) {
    this.ctx.console.broadcast('data', {
      key: this.name,
      value: value || await this.get(true),
    })
  }
}
