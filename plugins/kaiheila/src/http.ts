import { App, Bot, Adapter, Logger, assertProperty, sanitize } from 'koishi'
import { KaiheilaBot } from './bot'
import { adaptSession, SharedConfig } from './utils'

const logger = new Logger('kaiheila')

export default class HttpServer extends Adapter<KaiheilaBot, SharedConfig> {
  constructor(app: App, config: SharedConfig) {
    assertProperty(app.options, 'port')
    config.path = sanitize(config.path || '/kaiheila')
    super(app, KaiheilaBot, config)
  }

  private async _listen(bot: KaiheilaBot) {
    Object.assign(bot, await bot.getSelf())
    bot.status = Bot.Status.GOOD
  }

  async start() {
    const { path = '' } = this.config
    this.app.router.post(path, (ctx) => {
      const { body } = ctx.request
      logger.debug('receive %o', body)

      const { challenge } = body.d
      ctx.status = 200
      if (challenge) {
        ctx.body = { challenge }
        return
      }

      const bot = this.bots.find(bot => bot.config.verifyToken === body.d.verify_token)
      if (!bot) return

      // dispatch events
      const session = adaptSession(bot, body.d)
      if (session) this.dispatch(session)
    })

    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  stop() {
    logger.debug('http server closing')
  }
}
