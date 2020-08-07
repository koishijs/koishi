import { App, Bot, Server } from 'koishi-core'
import { Logger, defineProperty, snakeCase } from 'koishi-utils'
import { toVersion } from './api'
import {} from 'koa-bodyparser'
import { createHmac } from 'crypto'
import axios from 'axios'

declare module 'koishi-core/dist/session' {
  interface Session {
    _response?: (payload: ResponsePayload) => void
  }
}

const logger = Logger.create('server')

export default class HttpServer extends Server {
  constructor (app: App) {
    if (!app.options.port) {
      throw new Error('missing configuration "port"')
    }
    super(app)
  }

  private async __listen (bot: Bot) {
    if (!bot.server) return
    bot.ready = true
    bot._request = async (action, params) => {
      const headers = { 'Content-Type': 'application/json' } as any
      if (bot.token) {
        headers.Authorization = `Token ${bot.token}`
      }
      const uri = new URL(action, bot.server).href
      const { data } = await axios.post(uri, params, { headers })
      return data
    }
    bot.version = toVersion(await bot.getVersionInfo())
    logger.debug('%d got version info', bot.selfId)
  }

  async _listen () {
    const { secret, path = '/' } = this.app.options
    this.router.post(path, (ctx) => {
      if (secret) {
        // no signature
        const signature = ctx.headers['x-signature']
        if (!signature) return ctx.status = 401

        // invalid signature
        const sig = createHmac('sha1', secret).update(ctx.request.rawBody).digest('hex')
        if (signature !== `sha1=${sig}`) return ctx.status = 403
      }

      logger.debug('receive %o', ctx.request.body)
      const meta = this.prepare(ctx.request.body)
      if (!meta) return ctx.status = 403

      const { quickOperationTimeout } = this.app.options
      if (quickOperationTimeout > 0) {
        // bypass koa's built-in response handling for quick operations
        ctx.respond = false
        ctx.res.writeHead(200, {
          'Content-Type': 'application/json',
        })

        // use defineProperty to avoid meta duplication
        defineProperty(meta, '$response', (data) => {
          meta._response = null
          clearTimeout(timer)
          ctx.res.write(JSON.stringify(snakeCase(data)))
          ctx.res.end()
        })

        const timer = setTimeout(() => {
          meta._response = null
          ctx.res.end()
        }, quickOperationTimeout)
      }

      // dispatch events
      this.dispatch(meta)
    })

    const { port } = this.app.options
    logger.debug('http server opening at', port)
    this.server.listen(port)
    await Promise.all(this.bots.map(bot => this.__listen(bot)))
  }

  _close () {
    logger.debug('http server closing')
    this.server.close()
  }
}
