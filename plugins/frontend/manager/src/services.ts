import { DataService } from '@koishijs/plugin-console'
import { Context, Dict } from 'koishi'

class ServiceProvider extends DataService<Dict<string>> {
  private cache: Dict<string>

  constructor(ctx: Context) {
    super(ctx, 'services')

    ctx.on('service', () => this.refresh())
  }

  async get(forced = false) {
    if (!forced && this.cache) return this.cache
    this.cache = {}
    for (const name of Context.Services) {
      const value = this.ctx[name]?.['ctx']?.state.id
      if (value) this.cache[name] = value
    }
    return this.cache
  }
}

export default ServiceProvider
