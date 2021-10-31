import { Context } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

class Logs implements DataSource<string> {
  constructor(private ctx: Context, private config: Logs.Config) {
    this.ctx.on('logger/data', (text) => {
      this.ctx.webui.broadcast('logs/data', text)
    })
  }

  get() {
    return this.ctx.serial('logger/read')
  }
}

namespace Logs {
  export interface Config {}
}

export default Logs
