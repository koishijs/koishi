import { App, Adapter, Logger, Bot, Platform, renameProperty } from 'koishi-core'
import { io, SocketOptions, ManagerOptions, Socket } from 'socket.io-client'
import { MewBot } from './bot'
import { MessageType, Payload } from './types'
import { adaptSession, adaptUser } from './utils'
const logger = new Logger('mew')

export type SocketIOOption = Partial<ManagerOptions & SocketOptions>

export abstract class SocketIoClient<P extends Platform = Platform> extends Adapter<P> {
  abstract prepare(bot: Bot.Instance<P>): Socket | Promise<Socket>
  abstract connect(bot: Bot.Instance<P>): Promise<void>

  private _listening = false

  static options = {
    timeout: 1e4,
    reconnectionDelay: 3e3,
    reconnectionDelayMax: 15e3,
    autoConnect: !1,
    transports: ['websocket'],
  }

  constructor(app: App, Bot: Bot.Constructor<P>, public options: SocketIOOption = {}) {
    super(app, Bot)
    this.options = { ...SocketIoClient.options, ...options }
  }

  private async _listen(bot: Bot.Instance<P>) {
    const { timeout, reconnectionDelay } = this.options

    const connect = async (resolve: (value: void) => void, reject: (reason: Error) => void) => {
      logger.debug('socket.io client opening')
      bot.status = Bot.Status.CONNECTING
      const socket = await this.prepare(bot)

      socket.on('error', error => logger.debug(error))

      socket.on('connect', () => {
        bot.socketio = socket
        logger.info('connect to socketio server:')
        this.connect(bot).then(() => {
          bot.status = Bot.Status.GOOD
          resolve()
        }, reject)
      })
      socket.open()
    }

    return new Promise(connect)
  }

  async start() {
    this._listening = true
    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  stop() {
    this._listening = false
    logger.debug('socketio client closing')
    for (const bot of this.bots) {
      bot.socketio?.close()
    }
  }
}

export class SocketIoClientImpl extends SocketIoClient<'mew'> {
  constructor(app: App) {
    super(app, MewBot, app.options.mew)
  }

  prepare() {
    return io('https://gateway.mew.fun', {
      timeout: 1e4,
      reconnectionDelay: 3e3,
      reconnectionDelayMax: 15e3,
      autoConnect: !1,
      transports: ['websocket'],
    })
  }

  connect(bot: MewBot) {
    return new Promise<void>((resolve) => {
      bot.socketio.emit(MessageType.Identity, JSON.stringify({
        token: bot.token,
        platform: 'web',
        active: true,
      }))

      if (bot.subscribeNodes) {
        bot.socketio.emit(MessageType.Subscription, JSON.stringify({
          node: {
            op: 'set',
            items: bot.subscribeNodes,
          },
        }))
      }

      bot.socketio.on(MessageType.Identity, (data) => {
        data = data.toString()
        let parsed: any
        try {
          parsed = JSON.parse(data)
        } catch (error) {
          return logger.warn('cannot parse message', data)
        }
        const self: any = adaptUser(parsed.user)
        renameProperty(self, 'selfId', 'userId')
        Object.assign(bot, self)
        logger.info('receive identity success')
      })

      bot.socketio.on(MessageType.Dispatch, async (data) => {
        data = data.toString()
        let parsed: Payload
        try {
          parsed = JSON.parse(data)
        } catch (error) {
          return logger.warn('cannot parse message', data)
        }
        const session = await adaptSession(bot, parsed)
        if (session) this.dispatch(session)
      })

      resolve()
    })
  }
}
