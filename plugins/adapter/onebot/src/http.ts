import { Adapter, assertProperty, Context, Logger, omit, Quester, Schema } from 'koishi'
import { BotConfig, OneBotBot } from './bot'
import { AdapterConfig, dispatchSession } from './utils'
import { createHmac } from 'crypto'

const logger = new Logger('onebot')

export class HttpServer extends Adapter<BotConfig, AdapterConfig> {
  static schema: Schema<BotConfig> = Schema.object({
    selfId: Schema.string().description('机器人的账号。').required(),
    password: Schema.string().role('secret').description('机器人的密码。'),
    token: Schema.string().role('secret').description('发送信息时用于验证的字段，应与 OneBot 配置文件中的 access_token 保持一致。'),
    endpoint: Schema.string().role('url').description('要连接的 OneBot 服务器地址。').required(),
    ...omit(Quester.Config.dict, ['endpoint']),
  })

  public bots: OneBotBot[]

  constructor(ctx: Context, config: AdapterConfig = {}) {
    super(ctx, config)
    assertProperty(ctx.app.options, 'port')
  }

  async connect(bot: OneBotBot) {
    const { endpoint, token } = bot.config
    if (!endpoint) return

    const http = this.ctx.http.extend(bot.config).extend({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`,
      },
    })

    bot.internal._request = async (action, params) => {
      return http.post('/' + action, params)
    }

    return bot.initialize()
  }

  async start() {
    const { secret, path = '/onebot' } = this.config
    this.ctx.router.post(path, (ctx) => {
      if (secret) {
        // no signature
        const signature = ctx.headers['x-signature']
        if (!signature) return ctx.status = 401

        // invalid signature
        const sig = createHmac('sha1', secret).update(ctx.request.rawBody).digest('hex')
        if (signature !== `sha1=${sig}`) return ctx.status = 403
      }

      const selfId = ctx.headers['x-self-id'].toString()
      const bot = this.bots.find(bot => bot.selfId === selfId)
      if (!bot) return ctx.status = 403

      logger.debug('receive %o', ctx.request.body)
      dispatchSession(bot, ctx.request.body)
    })
  }

  stop() {
    logger.debug('http server closing')
  }
}
