import { App, Adapter, Bot } from 'koishi-core'
import { Logger, defineProperty, snakeCase, assertProperty } from 'koishi-utils'
import { CQBot } from './bot'
import { createSession } from './utils'
import { createHmac } from 'crypto'
import axios from 'axios'

export interface ResponsePayload {
  delete?: boolean
  ban?: boolean
  banDuration?: number
  kick?: boolean
  reply?: string
  autoEscape?: boolean
  atSender?: boolean
  approve?: boolean
  remark?: string
  reason?: string
}

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
    const { onebot = {} } = this.app.options
    const { secret, path = '' } = onebot
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

      const { quickOperation } = onebot
      if (session && quickOperation > 0) {
        // bypass koa's built-in response handling for quick operations
        ctx.respond = false
        ctx.res.writeHead(200, {
          'Content-Type': 'application/json',
        })

        // use defineProperty to avoid meta duplication
        defineProperty(session, '$response', (data: any) => {
          session._response = null
          clearTimeout(timer)
          ctx.res.write(JSON.stringify(snakeCase(data)))
          ctx.res.end()
        })

        const timer = setTimeout(() => {
          session._response = null
          ctx.res.end()
        }, quickOperation)
      }

      // dispatch events
      if (session) this.dispatch(session)
    })

    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  stop() {
    logger.debug('http server closing')
  }
}
