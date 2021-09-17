import { App, Adapter, Logger, assertProperty, Session, Schema } from 'koishi'
import { BotConfig, CQBot } from './bot'
import { adaptSession, AdapterConfig } from './utils'
import { createHmac } from 'crypto'

const logger = new Logger('onebot')

export class HttpServer extends Adapter<BotConfig, AdapterConfig> {
  static schema: Schema<BotConfig> = Schema.merge([
    Schema.object({
      selfId: Schema.string(),
      token: Schema.string(),
    }),
    App.Config.Request,
  ])

  constructor(app: App, config: AdapterConfig = {}) {
    super(app, config)
    assertProperty(app.options, 'port')
    this.http = app.http.extend(config.request)
  }

  async connect(bot: CQBot) {
    const { request, token } = bot.config
    if (!request?.endpoint) return

    const http = this.http.extend(bot.config.request).extend({
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
