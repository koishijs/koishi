import { Adapter, assertProperty, Context, Logger, Quester, sanitize, Schema } from 'koishi'
import { BotConfig, KaiheilaBot } from './bot'
import { AdapterConfig, adaptSession } from './utils'

const logger = new Logger('kaiheila')

export default class HttpServer extends Adapter<BotConfig, AdapterConfig> {
  static schema = Schema.intersect([
    Schema.object({
      token: Schema.string().description('机器人的用户令牌。').role('secret').required(),
      verifyToken: Schema.string().description('机器人的验证令牌。').required(),
    }),
    Quester.Config,
  ])

  constructor(ctx: Context, config: AdapterConfig) {
    assertProperty(ctx.app.options, 'port')
    config.path = sanitize(config.path || '/kaiheila')
    super(ctx, config)
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
