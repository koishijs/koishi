import { Context } from 'koishi'
import { Console } from './server'

export abstract class DataSource<T = any> {
  abstract get(forced?: boolean): Promise<T>

  constructor(protected ctx: Context, protected type: keyof Console.Sources) {
    ctx.console.sources[type] = this as never
    ctx.on('disconnect', () => {
      delete ctx.console.sources[type]
    })
  }

  async broadcast(value?: T) {
    this.ctx.console.broadcast('data', {
      key: this.type,
      value: value || await this.get(true),
    })
  }
}

export class ServiceProvider extends DataSource<string[]> {
  constructor(ctx: Context) {
    super(ctx, 'services')

    ctx.on('service', () => this.broadcast())
  }

  async get() {
    return Object.keys(Context.Services).filter(key => this.ctx[key])
  }
}
