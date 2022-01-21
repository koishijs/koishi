import { DataSource } from '@koishijs/plugin-console'
import { Context, Dict } from 'koishi'

export default class ServiceProvider extends DataSource<Dict<string>> {
  constructor(ctx: Context) {
    super(ctx, 'services')

    ctx.on('service', () => this.broadcast())
  }

  async get() {
    const result: Dict<string> = {}
    for (const name of Context.Services) {
      const value = this.ctx[name]?.['ctx']?.state.id
      if (value) result[name] = value
    }
    return result
  }
}
