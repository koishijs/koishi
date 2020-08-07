import { CQResponse } from './api'
import { Server, Bot } from 'koishi-core'
import { Logger, camelCase } from 'koishi-utils'
import { toVersion } from './api'
import type WebSocket from 'ws'

declare module 'koishi-core/dist/server' {
  interface Bot {
    socket?: WebSocket
  }
}

const logger = Logger.create('server')

let counter = 0

export default class Channel {
  private _listeners: Record<number, (response: CQResponse) => void> = {}

  constructor (private server: Server) {}

  connect = (resolve: () => void, reject: (error: Error) => void, bot: Bot, socket: WebSocket) => {
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
        const meta = this.server.prepare(parsed)
        if (meta) this.server.dispatch(meta)
      } else if (parsed.echo === -1) {
        logger.debug('%d got version info', bot.selfId)
        bot.version = toVersion(camelCase(parsed.data))
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
