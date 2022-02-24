import { Context, Service } from 'koishi'
import Console from '.'

export namespace DataService {
  export interface Options {
    authority?: number
  }
}

export abstract class DataService<T = never> extends Service {
  static define(name: keyof Console.Services) {
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

  public get(forced?: boolean): Promise<T> {
    return null
  }

  constructor(protected ctx: Context, protected name: keyof Console.Services, public options: DataService.Options = {}) {
    super(ctx, `console.${name}`, true)
    DataService.define(name)
  }

  start() {
    this.refresh()
  }

  protected broadcast(type: string, value: any) {
    this.ctx.console.ws.broadcast(type, { key: this.name, value }, this.options)
  }

  async refresh() {
    this.broadcast('data', await this.get(true))
  }

  patch(value: T) {
    this.broadcast('patch', value)
  }
}
