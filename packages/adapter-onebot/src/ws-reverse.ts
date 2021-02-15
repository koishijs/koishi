import { App, Server } from 'koishi-core'
import { Logger, assertProperty } from 'koishi-utils'
import { CQBot } from './bot'
import type WebSocket from 'ws'
import Socket from './socket'

const logger = new Logger('server')

export default class WsServer extends Server<'onebot'> {
  public wsServer?: WebSocket.Server
  private _channel: Socket

  constructor(app: App) {
    assertProperty(app.options, 'port')
    super(app, CQBot)
    this._channel = new Socket(this)
    const { onebot = {} } = this.app.options
    const { path = '/' } = onebot
    const ws: typeof WebSocket = require('ws')
    this.wsServer = new ws.Server({
      path,
      server: this.app._httpServer,
    })
  }

  listen() {
    return new Promise<void>((resolve, reject) => {
      this.wsServer.on('error', reject)
      this.wsServer.on('connection', (socket, { headers }) => {
        logger.debug('connected with', headers)
        if (headers['x-client-role'] !== 'Universal') {
          return socket.close(1008, 'invalid x-client-role')
        }
        let bot: CQBot
        const selfId = headers['x-self-id'].toString()
        if (!(bot = this.bots[selfId])) {
          return socket.close(1008, 'invalid x-self-id')
        }
        if (!bot.selfId) bot.selfId = selfId

        this._channel.connect(bot, socket).then(() => {
          if (this.bots.every(({ version, server }) => version || server === null)) resolve()
        }, reject)
      })
    })
  }

  close() {
    logger.debug('ws server closing')
    this.wsServer.close()
  }
}
