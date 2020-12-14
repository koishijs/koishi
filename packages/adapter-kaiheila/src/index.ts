import { App, Server } from 'koishi-core'
import { Logger, defineProperty, assertProperty } from 'koishi-utils'
import { createSession, KaiheilaBot } from './bot'
import { createHmac } from 'crypto'
import axios from 'axios'

interface KaiheilaOptions {
  path?: string
}

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    kaiheila?: KaiheilaOptions
  }
}

const logger = new Logger('server')

export default class HttpServer extends Server<KaiheilaBot> {
  constructor(app: App) {
    assertProperty(app.options, 'port')
    super(app, KaiheilaBot)
  }

  private async _listen(bot: KaiheilaBot) {
    bot.ready = true
  }

  async listen() {
    const { kaiheila = {} } = this.app.options
    const { path = '/' } = kaiheila
    this.app.router.post(path, (ctx) => {
      logger.debug('receive %o', ctx.request.body)
      const session = createSession(this.app, ctx.request.body)
      ctx.body = {}

      // dispatch events
      console.log(session)
      // this.dispatch(session)
    })

    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  close() {
    logger.debug('http server closing')
  }
}
