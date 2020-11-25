import { App, Server, AppStatus } from 'koishi-core'
import { Logger, Time } from 'koishi-utils'
import { CQBot } from './bot'
import type WebSocket from 'ws'
import Channel from './channel'
import ms from 'ms'

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    retryTimes?: number
    retryInterval?: number
  }
}

App.defaultConfig.retryInterval = 5 * Time.second

const logger = new Logger('server')

export default class WsClient extends Server<CQBot> {
  private _retryCount = 0
  private _channel = new Channel(this)
  private _sockets = new Set<WebSocket>()

  constructor(app: App) {
    super(app, CQBot)
  }

  private async _listen(bot: CQBot) {
    const { token, server } = bot
    if (!server) return
    const Socket: typeof WebSocket = require('ws')
    const connect = (resolve: (value: void) => void, reject: (reason: Error) => void) => {
      logger.debug('websocket client opening')
      const headers: Record<string, string> = {}
      const { retryInterval, retryTimes } = this.app.options
      if (token) headers.Authorization = `Bearer ${token}`
      const socket = new Socket(server, { headers })
      this._sockets.add(socket)

      socket.on('error', error => logger.debug(error))

      socket.on('close', (code) => {
        this._sockets.delete(socket)
        if (this.app.status !== AppStatus.open || code === 1005) return

        const message = `failed to connect to ${server}`
        if (!retryInterval || this._retryCount >= retryTimes) {
          return reject(new Error(message))
        }

        this._retryCount++
        logger.warn(`${message}, will retry in ${ms(retryInterval)}...`)
        setTimeout(() => {
          if (this.app.status === AppStatus.open) connect(resolve, reject)
        }, retryInterval)
      })

      socket.on('open', () => {
        this._retryCount = 0
        logger.debug('connect to ws server:', bot.server)
        this._channel.connect(resolve, reject, bot, socket)
      })
    }
    return new Promise(connect)
  }

  async listen() {
    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  close() {
    logger.debug('websocket client closing')
    for (const socket of this._sockets) {
      socket.close()
    }
    this._retryCount = 0
  }
}
