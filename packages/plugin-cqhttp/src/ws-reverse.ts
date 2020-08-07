import { Bot } from 'koishi-core'
import { Logger } from 'koishi-utils'
import HttpServer from './http'
import Channel from './channel'
import type WebSocket from 'ws'

const logger = Logger.create('server')

export default class WsServer extends HttpServer {
  public wsServer?: WebSocket.Server
  private _channel = new Channel(this)

  _listen () {
    const { port, path = '/' } = this.app.options
    const ws: typeof WebSocket = require('ws')
    logger.debug('ws server opening at', port)
    this.server = this.koa.listen(port)
    this.wsServer = new ws.Server({
      path,
      server: this.server,
    })

    return new Promise<void>((resolve, reject) => {
      this.wsServer.on('error', reject)
      this.wsServer.on('connection', (socket, { headers }) => {
        logger.debug('connected with', headers)
        if (headers['x-client-role'] !== 'Universal') {
          return socket.close(1008, 'invalid x-client-role')
        }
        let bot: Bot
        const selfId = +headers['x-self-id']
        if (!selfId || !(bot = this.bots[selfId] || this.bots.find(bot => !bot.selfId))) {
          return socket.close(1008, 'invalid x-self-id')
        }
        if (!bot.selfId) bot.selfId = selfId

        socket.on('close', () => {
          delete bot.socket
          delete bot._get
        })

        bot.socket = socket
        this._channel.connect(() => {
          if (this.bots.every(({ version, server }) => version || server === null)) resolve()
        }, reject, bot)
      })
    })
  }

  _close () {
    logger.debug('ws server closing')
    this.wsServer.close()
    super._close()
  }
}
