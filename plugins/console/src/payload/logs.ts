import { Context } from 'koishi'
import { StatusServer } from '../server'

class Logs implements StatusServer.DataSource {
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
