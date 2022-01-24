import { Context, Service } from 'koishi'
import Console, { Sources } from '.'

export abstract class DataSource<T = any> extends Service {
  static define(name: keyof Sources) {
    if (Object.prototype.hasOwnProperty.call(Console.prototype, name)) return
    const key = `console.${name}`
    Object.defineProperty(Console.prototype, name, {
      get(this: Console) {
        return this.caller[key]
      },
      set(this: Console, value) {
        this.caller[key] = value
      },
    })
  }

  protected get(forced?: boolean): Promise<T> {
    return null
  }

  constructor(protected ctx: Context, protected name: keyof Sources) {
    super(ctx, `console.${name}`, true)
    DataSource.define(name)
  }

  protected broadcast(type: string, value: any) {
    this.ctx.console.ws.broadcast(type, { key: this.name, value })
  }

  async refresh() {
    this.broadcast('data', await this.get(true))
  }

  patch(value: T) {
    this.broadcast('patch', value)
  }
}
