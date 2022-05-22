import { DataService } from '@koishijs/plugin-console'
import { Context, Dict } from 'koishi'

class ServiceProvider extends DataService<Dict<string>> {
  private cache: Dict<string>

  constructor(ctx: Context) {
    super(ctx, 'services', { authority: 4 })

    ctx.on('service', () => this.refresh())
  }

  async get(forced = false) {
    if (!forced && this.cache) return this.cache
    this.cache = {}
    for (const name of Context.Services) {
      const value = this.ctx[name]?.['ctx']?.state.id
      if (this.ctx[name]) this.cache[name] = value ?? null
    }
    return this.cache
  }
}

export default ServiceProvider
