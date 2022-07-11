import { Context, Service } from 'koishi'
import Console from '.'

export namespace DataService {
  export interface Options {
    authority?: number
  }
}

export abstract class DataService<T = never> extends Service {
  static keys = new Set<string>()

  static define(name: keyof Console.Services) {
    this.keys.add(name)
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

  constructor(protected ctx: Context, protected key: keyof Console.Services, public options: DataService.Options = {}) {
    super(ctx, `console.${key}`, true)
    DataService.define(key)
  }

  start() {
    this.refresh()
  }

  protected broadcast(type: string, value: any) {
    this.ctx.console?.ws.broadcast(type, { key: this.key, value }, this.options)
  }

  async refresh() {
    this.broadcast('data', await this.get(true))
  }

  patch(value: T) {
    this.broadcast('patch', value)
  }
}
