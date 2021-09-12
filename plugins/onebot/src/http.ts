import { App, Adapter, Logger, assertProperty, Session } from 'koishi'
import { CQBot } from './bot'
import { adaptSession, SharedConfig } from './utils'
import { createHmac } from 'crypto'
import axios from 'axios'

const logger = new Logger('onebot')

export default class HttpServer extends Adapter<CQBot.Config, SharedConfig> {
  constructor(app: App, config: SharedConfig = {}) {
    super(app, config)
    assertProperty(app.options, 'port')
  }

  async connect(bot: CQBot) {
    const { server, token } = bot.config
    if (!server) return

    bot._request = async (action, params) => {
      const headers = { 'Content-Type': 'application/json' } as any
      if (token) {
        headers.Authorization = `Token ${token}`
      }
      const uri = new URL(action, server).href
      const { data } = await axios.post(uri, params, { headers })
      return data
    }

    Object.assign(bot, await bot.getSelf())
    logger.info('connected to %c', server)
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
