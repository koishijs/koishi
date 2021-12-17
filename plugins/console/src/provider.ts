import { Awaitable, Context } from 'koishi'
import { Console } from './server'

export abstract class DataSource<T = any> {
  protected start(): Awaitable<void> {}
  protected stop(): Awaitable<void> {}
  protected abstract get(forced?: boolean): Promise<T>

  constructor(protected ctx: Context, protected name: keyof Console.Services) {
    ctx.console.services[name] = this as never

    ctx.on('ready', () => this.start())
    ctx.on('dispose', () => this.stop())
  }

  async broadcast(value?: T) {
    this.ctx.console.broadcast('data', {
      key: this.name,
      value: value || await this.get(true),
    })
  }
}
