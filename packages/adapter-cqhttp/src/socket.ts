import { CQBot, CQResponse, toVersion } from './bot'
import { Server, Session } from 'koishi-core'
import { Logger, camelCase } from 'koishi-utils'
import type WebSocket from 'ws'

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    server?: string
    token?: string
  }
}

const logger = new Logger('server')

export function createSession(server: Server, data: any) {
  const session = new Session(server.app, camelCase(data))
  session.kind = 'qq'
  if (session.postType === 'message') {
    session.channelId = session.messageType === 'group'
      ? `group:${session.groupId}`
      : `private:${session.userId}`
  }
  return session
}

let counter = 0

export default class Socket {
  private _listeners: Record<number, (response: CQResponse) => void> = {}

  constructor(private server: Server) {}

  connect = (resolve: (value: void) => void, reject: (error: Error) => void, bot: CQBot, socket: WebSocket) => {
    bot.ready = true
    bot.socket = socket

    socket.on('message', (data) => {
      data = data.toString()
      let parsed: any
      try {
        parsed = JSON.parse(data)
      } catch (error) {
        return logger.warn('cannot parse message', data)
      }

      if ('post_type' in parsed) {
        logger.debug('receive %o', parsed)
        const session = createSession(this.server, parsed)
        this.server.dispatch(session)
      } else if (parsed.echo === -1) {
        bot.version = toVersion(camelCase(parsed.data))
        logger.debug('%d got version info', bot.selfId)
        if (bot.server) {
          logger.info('connected to %c', bot.server)
        }
        resolve()
      } else {
        this._listeners[parsed.echo]?.(parsed)
      }
    })

    socket.on('close', () => {
      delete bot._request
      delete bot.socket
      bot.ready = false
    })

    socket.send(JSON.stringify({
      action: 'get_version_info',
      echo: -1,
    }), (error) => {
      if (error) reject(error)
    })

    bot._request = (action, params) => {
      const data = { action, params, echo: ++counter }
      data.echo = ++counter
      return new Promise((resolve, reject) => {
        this._listeners[counter] = resolve
        socket.send(JSON.stringify(data), (error) => {
          if (error) reject(error)
        })
      })
    }
  }
}
