import { Adapter, App, Bot } from '@koishijs/core'
import { Logger, Time } from '@koishijs/utils'
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

  export abstract class WebSocketClient<T extends Bot> extends Adapter<T> {
    protected abstract prepare(bot: T): WebSocket | Promise<WebSocket>
    protected abstract connect(bot: T): Promise<void>

    private _listening = false
    public config: WebSocketClient.Config

    static config: WebSocketClient.Config = {
      retryLazy: Time.minute,
      retryInterval: 5 * Time.second,
      retryTimes: 6,
    }

    constructor(app: App, Bot: Bot.Constructor<T>, options: WebSocketClient.Config = {}) {
      super(app, Bot)
      this.config = { ...WebSocketClient.config, ...options }
    }

    private async _listen(bot: T) {
      let _retryCount = 0
      const { retryTimes, retryInterval, retryLazy } = this.config

      const connect = async (resolve: (value: void) => void, reject: (reason: Error) => void) => {
        logger.debug('websocket client opening')
        bot.status = Bot.Status.CONNECTING
        const socket = await this.prepare(bot)
        const url = socket.url.replace(/\?.+/, '')

        socket.on('error', error => logger.debug(error))

        socket.on('close', (code, reason) => {
          bot.socket = null
          bot.status = Bot.Status.NET_ERROR
          logger.debug(`websocket closed with ${code}`)
          if (!this._listening) return

          // remove query args to protect privacy
          const message = reason || `failed to connect to ${url}`
          let timeout = retryInterval
          if (_retryCount >= retryTimes) {
            if (this.app.status === App.Status.open) {
              timeout = retryLazy
            } else {
              return reject(new Error(message))
            }
          }

          _retryCount++
          logger.warn(`${message}, will retry in ${Time.formatTimeShort(timeout)}...`)
          setTimeout(() => {
            if (this._listening) connect(resolve, reject)
          }, timeout)
        })

        socket.on('open', () => {
          _retryCount = 0
          bot.socket = socket
          logger.info('connect to ws server:', url)
          this.connect(bot).then(() => {
            bot.status = Bot.Status.GOOD
            resolve()
          }, reject)
        })
      }

      return new Promise(connect)
    }

    async start() {
      this._listening = true
      await Promise.all(this.bots.map(bot => this._listen(bot)))
    }

    stop() {
      this._listening = false
      logger.debug('websocket client closing')
      for (const bot of this.bots) {
        bot.socket?.close()
      }
    }
  }
}

Object.assign(Adapter, InjectedAdapter)
