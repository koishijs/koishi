import { Adapter, Bot, Context, Schema } from '@koishijs/core'
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

  export abstract class WebSocketClient<S extends Bot.BaseConfig, T extends WebSocketClient.Config> extends Adapter<S, T> {
    protected abstract prepare(bot: Bot<S>): Awaitable<WebSocket>
    protected abstract accept(bot: Bot<S>): void

    public config: T
    public isListening = false

    static Config: Schema<WebSocketClient.Config> = Schema.object({
      retryTimes: Schema.natural().description('初次连接时的最大重试次数，仅用于 ws 协议。').default(6),
      retryInterval: Schema.natural().role('ms').description('初次连接时的重试时间间隔，仅用于 ws 协议。').default(5 * Time.second),
      retryLazy: Schema.natural().role('ms').description('连接关闭后的重试时间间隔，仅用于 ws 协议。').default(Time.minute),
    }).description('连接设置')

    constructor(ctx: Context, config: T) {
      super(ctx, {
        retryLazy: Time.minute,
        retryInterval: 5 * Time.second,
        retryTimes: 6,
        ...config,
      })
    }

    connect(bot: Bot<S>) {
      let _retryCount = 0
      const { retryTimes, retryInterval, retryLazy } = this.config

      const reconnect = async (initial = false) => {
        logger.debug('websocket client opening')
        const socket = await this.prepare(bot)
        const url = socket.url.replace(/\?.+/, '')

        socket.on('error', error => logger.debug(error))

        socket.on('close', (code, reason) => {
          bot.socket = null
          logger.debug(`websocket closed with ${code}`)
          if (!this.isListening || bot.config.disabled) return bot.status = 'offline'

          // remove query args to protect privacy
          const message = reason.toString() || `failed to connect to ${url}`
          let timeout = retryInterval
          if (_retryCount >= retryTimes) {
            if (initial) {
              return bot.reject(new Error(message))
            } else {
              timeout = retryLazy
            }
          }

          _retryCount++
          bot.status = 'reconnect'
          logger.warn(`${message}, will retry in ${Time.formatTimeShort(timeout)}...`)
          setTimeout(() => {
            if (this.isListening && !bot.config.disabled) reconnect()
          }, timeout)
        })

        socket.on('open', () => {
          _retryCount = 0
          bot.socket = socket
          logger.info('connect to server: %c', url)
          this.accept(bot)
        })
      }

      reconnect(true)
    }

    disconnect(bot: Bot) {
      bot.socket?.close()
    }

    start() {
      this.isListening = true
    }

    stop() {
      this.isListening = false
      logger.debug('websocket client closing')
      for (const bot of this.bots) {
        bot.socket?.close()
      }
    }
  }
}

Object.assign(Adapter, InjectedAdapter)
