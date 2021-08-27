import { App, Adapter, Bot, Logger, assertProperty } from 'koishi'
import { CQBot } from './bot'
import { createSession } from './utils'
import { createHmac } from 'crypto'
import axios from 'axios'

const logger = new Logger('onebot')

export default class HttpServer extends Adapter<'onebot'> {
  constructor(app: App) {
    assertProperty(app.options, 'port')
    super(app, CQBot)
  }

  private async _listen(bot: CQBot) {
    if (!bot.server) return
    bot.status = Bot.Status.GOOD
    bot._request = async (action, params) => {
      const headers = { 'Content-Type': 'application/json' } as any
      if (bot.token) {
        headers.Authorization = `Token ${bot.token}`
      }
      const uri = new URL(action, bot.server).href
      const { data } = await axios.post(uri, params, { headers })
      return data
    }
    Object.assign(bot, await bot.getSelf())
    logger.info('connected to %c', bot.server)
  }

  async start() {
    const { secret, path = '/onebot', quickOperation } = CQBot.config
    this.app.router.post(path, (ctx) => {
      if (secret) {
        // no signature
        const signature = ctx.headers['x-signature']
        if (!signature) return ctx.status = 401

        // invalid signature
        const sig = createHmac('sha1', secret).update(ctx.request.rawBody).digest('hex')
        if (signature !== `sha1=${sig}`) return ctx.status = 403
      }

      logger.debug('receive %o', ctx.request.body)
      const session = createSession(this, ctx.request.body)

      // dispatch events
      if (session) this.dispatch(session)
    })

    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  stop() {
    logger.debug('http server closing')
  }
}
