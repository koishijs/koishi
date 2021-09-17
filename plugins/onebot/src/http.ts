import { App, Adapter, Logger, assertProperty, Session, Schema, Requester } from 'koishi'
import { BotConfig, CQBot } from './bot'
import { adaptSession, AdapterConfig } from './utils'
import { createHmac } from 'crypto'

const logger = new Logger('onebot')

export class HttpServer extends Adapter<BotConfig, AdapterConfig> {
  static schema: Schema<BotConfig> = Schema.object({
    selfId: Schema.string('机器人的账号。').required(),
    token: Schema.string('发送信息时用于验证的字段，应与 OneBot 的 access_token 配置保持一致。'),
    ...Requester.Config.dict,
  })

  constructor(app: App, config: AdapterConfig = {}) {
    super(app, config)
    assertProperty(app.options, 'port')
    this.http = app.http.extend(config.request)
  }

  async connect(bot: CQBot) {
    const { endpoint, token } = bot.config
    if (!endpoint) return

    const http = this.http.extend(bot.config).extend({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`,
      },
    })

    bot._request = async (action, params) => {
      return http.post('/' + action, params)
    }

    Object.assign(bot, await bot.getSelf())
    logger.info('connected to %c', http.config.endpoint)
    bot.resolve()
  }

  async start() {
    const { secret, path = '/onebot' } = this.config
    this.app.router.post(path, (ctx) => {
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
      const session = adaptSession(ctx.request.body)

      // dispatch events
      if (session) this.dispatch(new Session(bot, session))
    })
  }

  stop() {
    logger.debug('http server closing')
  }
}
