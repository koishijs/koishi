import { Context } from 'koishi'
import { DataSource } from '../server'

class Logs implements DataSource<string> {
  constructor(private ctx: Context) {
    this.ctx.on('logger/data', (text) => {
      this.ctx.webui.broadcast('logs/data', text)
    })
  }

  get() {
    return this.ctx.serial('logger/read')
  }
}

namespace Logs {}

export default Logs
