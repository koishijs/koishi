import { App, Adapter, Logger, assertProperty, sanitize, Schema, Context } from 'koishi'
import { BotConfig, KaiheilaBot } from './bot'
import { adaptSession, AdapterConfig } from './utils'

const logger = new Logger('kaiheila')

export default class HttpServer extends Adapter<BotConfig, AdapterConfig> {
  static schema = Schema.object({
    token: Schema.string('机器人的用户令牌。').required(),
    verifyToken: Schema.string('机器人的验证令牌。').required(),
  })

  constructor(ctx: Context, config: AdapterConfig) {
    assertProperty(ctx.app.options, 'port')
    config.path = sanitize(config.path || '/kaiheila')
    super(ctx, config)
    this.http = ctx.http.extend({
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
    this.ctx.router.post(path, (ctx) => {
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
