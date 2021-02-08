import { App, Server, AppStatus } from 'koishi-core'
import { Logger } from 'koishi-utils'
import { CQBot } from './bot'
import type WebSocket from 'ws'
import Socket from './socket'
import ms from 'ms'

const logger = new Logger('server')

export default class WsClient extends Server<'onebot'> {
  private _channel = new Socket(this)
  private _sockets = new Set<WebSocket>()

  constructor(app: App) {
    super(app, CQBot)
  }

  private async _listen(bot: CQBot) {
    const { token, server } = bot
    if (!server) return
    let _retryCount = 0
    const Socket: typeof WebSocket = require('ws')
    const connect = (resolve: (value: void) => void, reject: (reason: Error) => void) => {
      logger.debug('websocket client opening')
      const headers: Record<string, string> = {}
      const { retryInterval, retryTimes } = this.app.options.onebot
      if (token) headers.Authorization = `Bearer ${token}`
      const socket = new Socket(server, { headers })
      this._sockets.add(socket)

      socket.on('error', error => logger.debug(error))

      socket.on('close', (code) => {
        this._sockets.delete(socket)
        if (this.app.status !== AppStatus.open || code === 1005) return

        const message = `failed to connect to ${server}`
        if (!retryInterval || _retryCount >= retryTimes) {
          return reject(new Error(message))
        }

        _retryCount++
        logger.warn(`${message}, will retry in ${ms(retryInterval)}...`)
        setTimeout(() => {
          if (this.app.status === AppStatus.open) connect(resolve, reject)
        }, retryInterval)
      })

      socket.on('open', () => {
        _retryCount = 0
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
  }
}
