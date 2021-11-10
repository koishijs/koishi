import { Context } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'
import {} from '@koishijs/cli'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      logs: LogProvider
    }
  }
}

export class LogProvider extends DataSource<string[]> {
  constructor(ctx: Context) {
    super(ctx, 'logs')

    ctx.on('logger/data', (text) => {
      ctx.console.broadcast('logs/data', text)
    })
  }

  async get() {
    return this.ctx.serial('logger/read')
  }
}
