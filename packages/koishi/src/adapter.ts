import { Adapter, App, Bot } from '@koishijs/core'
import { Logger, Time, Awaitable } from '@koishijs/utils'
import WebSocket from 'ws'

declare module '@koishijs/core' {
  interface Bot {
    socket?: WebSocket
  }
}

export namespace InjectedAdapter {
  const logger = new Logger('adapter')

  export namespace WebSocketClient {
    export interface Config {
      retryLazy?: number
      retryTimes?: number
      retryInterval?: number
    }
  }

  export abstract class WebSocketClient<S extends Bot, T extends WebSocketClient.Config> extends Adapter<S, T> {
    protected abstract prepare(bot: S): Awaitable<WebSocket>
    protected abstract accept(bot: S): void

    public config: T

    static config: WebSocketClient.Config = {
      retryLazy: Time.minute,
      retryInterval: 5 * Time.second,
      retryTimes: 6,
    }

    constructor(app: App, Bot: Bot.Constructor<S>, config: T) {
      super(app, Bot, {
        ...WebSocketClient.config,
        ...config,
      })
    }

    connect(bot: S) {
      let _retryCount = 0
      const { retryTimes, retryInterval, retryLazy } = this.config

      const reconnect = async () => {
        logger.debug('websocket client opening')
        bot.status = Bot.Status.CONNECTING
        const socket = await this.prepare(bot)
        const url = socket.url.replace(/\?.+/, '')

        socket.on('error', error => logger.debug(error))

        socket.on('close', (code, reason) => {
          bot.socket = null
          bot.status = Bot.Status.NET_ERROR
          logger.debug(`websocket closed with ${code}`)
          if (!this.app.isActive()) return

          // remove query args to protect privacy
          const message = reason || `failed to connect to ${url}`
          let timeout = retryInterval
          if (_retryCount >= retryTimes) {
            if (this.app.status === App.Status.open) {
              timeout = retryLazy
            } else {
              return bot.reject(new Error(message))
            }
          }

          _retryCount++
          logger.warn(`${message}, will retry in ${Time.formatTimeShort(timeout)}...`)
          setTimeout(() => {
            if (this.app.isActive()) reconnect()
          }, timeout)
        })

        socket.on('open', () => {
          _retryCount = 0
          bot.socket = socket
          logger.info('connect to ws server:', url)
          this.accept(bot)
        })
      }

      reconnect()
    }

    start() {}

    stop() {
      logger.debug('websocket client closing')
      for (const bot of this.bots) {
        bot.socket?.close()
      }
    }
  }
}

Object.assign(Adapter, InjectedAdapter)
