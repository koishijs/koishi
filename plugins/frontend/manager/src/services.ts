import { DataSource } from '@koishijs/plugin-console'
import { Context, Dict } from 'koishi'

export default class ServiceProvider extends DataSource<Dict<string>> {
  constructor(ctx: Context) {
    super(ctx, 'services')

    ctx.on('service', () => this.broadcast())
  }

  async get() {
    return this.ctx.app._services
  }
}
