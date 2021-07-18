import { App, Bot, Adapter, Logger, assertProperty } from 'koishi'
import { KaiheilaBot } from './bot'
import { adaptSession } from './utils'

const logger = new Logger('kaiheila')

export default class HttpServer extends Adapter<'kaiheila'> {
  constructor(app: App) {
    assertProperty(app.options, 'port')
    super(app, KaiheilaBot)
  }

  private async _listen(bot: KaiheilaBot) {
    Object.assign(bot, await bot.getSelf())
    bot.status = Bot.Status.GOOD
  }

  async start() {
    const { path = '' } = KaiheilaBot.config
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
      const session = adaptSession(bot, body.d)
      if (session) this.dispatch(session)
    })

    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  stop() {
    logger.debug('http server closing')
  }
}
