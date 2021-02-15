import { App, Server } from 'koishi-core'
import { Logger, assertProperty } from 'koishi-utils'
import { createSession, KaiheilaBot } from './bot'

const logger = new Logger('kaiheila')

function trimSlash(source: string) {
  return source.replace(/\/$/, '')
}

export default class HttpServer extends Server<'kaiheila'> {
  constructor(app: App) {
    assertProperty(app.options, 'port')
    super(app, KaiheilaBot)
    const config = this.app.options.kaiheila ||= {}
    config.path ||= '/kaiheila'
    config.endpoint = trimSlash(config.endpoint || 'https://www.kaiheila.cn/api/v3')
  }

  private async _listen(bot: KaiheilaBot) {
    bot.ready = true
  }

  async listen() {
    const { kaiheila = {} } = this.app.options
    const { path = '' } = kaiheila
    this.app.router.post(path, (ctx) => {
      const { body } = ctx.request
      logger.debug('receive %o', body)

      const { challenge } = body.d
      ctx.status = 200
      if (challenge) {
        ctx.body = { challenge }
        return
      }

      const bot = this.bots.find(bot => bot.verifyToken === body.d.verify_token)
      if (!bot) return

      // dispatch events
      const session = createSession(bot, body.d)
      if (session) this.dispatch(session)
    })

    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  close() {
    logger.debug('http server closing')
  }
}
