import { App, Adapter } from 'koishi-core'
import { Logger, assertProperty } from 'koishi-utils'
import { connect } from './utils'
import { CQBot } from './bot'
import WebSocket from 'ws'

const logger = new Logger('onebot')

export class WsClient extends Adapter.WsClient<'onebot'> {
  connect = connect

  constructor(app: App) {
    super(app, CQBot, app.options.onebot)
  }

  createSocket(bot: CQBot) {
    const headers: Record<string, string> = {}
    if (bot.token) headers.Authorization = `Bearer ${bot.token}`
    return new WebSocket(bot.server, { headers })
  }
}

export class WsServer extends Adapter<'onebot'> {
  public wsServer?: WebSocket.Server

  constructor(app: App) {
    assertProperty(app.options, 'port')
    super(app, CQBot)
    const { onebot = {} } = this.app.options
    const { path = '/' } = onebot
    this.wsServer = new WebSocket.Server({
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
        const selfId = headers['x-self-id'].toString()
        const bot = this.bots[selfId]
        if (!bot) return socket.close(1008, 'invalid x-self-id')

        bot.socket = socket
        connect(bot).then(() => {
          if (this.bots.every(({ version, server }) => version || server === null)) resolve()
        }, reject)
      })
    })
  }

  close() {
    logger.debug('ws server closing')
    this.wsServer.close()
    for (const bot of this.bots) {
      bot.socket = null
    }
  }
}
