import { App, Adapter, Logger, assertProperty, sanitize } from 'koishi'
import { KaiheilaBot } from './bot'
import { adaptSession, SharedConfig } from './utils'

const logger = new Logger('kaiheila')

export default class HttpServer extends Adapter<KaiheilaBot.Config, SharedConfig> {
  constructor(app: App, config: SharedConfig) {
    assertProperty(app.options, 'port')
    config.path = sanitize(config.path || '/kaiheila')
    super(app, config)
    this.http = app.http.extend({
      endpoint: 'https://www.kaiheila.cn/api/v3',
      ...config.request,
    })
  }

  async connect(bot: KaiheilaBot) {
    Object.assign(bot, await bot.getSelf())
    bot.resolve()
  }

  start() {
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
  }

  stop() {}
}
