import { Context } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      services: ServiceProvider
    }
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
