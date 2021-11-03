import { Context } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

declare module '@koishijs/plugin-console' {
  namespace DataSource {
    interface Library {
      services: ServiceSource
    }
  }
}

export class ServiceSource implements DataSource<string[]> {
  constructor(private ctx: Context) {
    ctx.on('service', async () => {
      this.ctx.webui.broadcast('data', {
        key: 'services',
        value: this.get(),
      })
    })
  }

  get() {
    return Object.keys(Context.Services).filter(key => this.ctx[key])
  }
}
