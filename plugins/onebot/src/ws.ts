import { App, Adapter, Logger, assertProperty, camelCase, Requester, Time, Session, Schema } from 'koishi'
import { BotConfig, CQBot } from './bot'
import { AdapterConfig, adaptSession, adaptUser, Response } from './utils'
import WebSocket from 'ws'

const logger = new Logger('onebot')

export class WebSocketClient extends Adapter.WebSocketClient<BotConfig, AdapterConfig> {
  static schema: Schema<BotConfig> = Schema.merge([
    Schema.object({
      selfId: Schema.string('机器人的账号。').required(),
      token: Schema.string('发送信息时用于验证的字段，应与 OneBot 的 access_token 配置保持一致。'),
    }),
    Requester.Config,
  ])

  protected accept = accept

  constructor(app: App, config: AdapterConfig) {
    super(app, config)
  }

  prepare(bot: CQBot) {
    const { endpoint, token } = bot.config
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    return new WebSocket(endpoint, { headers })
  }
}

export class WebSocketServer extends Adapter<BotConfig, AdapterConfig> {
  static schema: Schema<BotConfig> = Schema.object({
    selfId: Schema.string('机器人的账号。').required(),
  })

  public wsServer?: WebSocket.Server

  protected accept = accept

  constructor(app: App, config: AdapterConfig) {
    super(app, config)
    assertProperty(app.options, 'port')
    const { path = '/onebot' } = config
    this.wsServer = new WebSocket.Server({
      path,
      server: this.app._httpServer,
    })
  }

  connect() {}

  async start() {
    this.wsServer.on('connection', (socket, { headers }) => {
      logger.debug('connected with', headers)
      if (headers['x-client-role'] !== 'Universal') {
        return socket.close(1008, 'invalid x-client-role')
      }
      const selfId = headers['x-self-id'].toString()
      const bot = this.bots.find(bot => bot.selfId === selfId)
      if (!bot) return socket.close(1008, 'invalid x-self-id')

      bot.socket = socket
      this.accept(bot as CQBot)
    })
  }

  stop() {
    logger.debug('ws server closing')
    this.wsServer.close()
    for (const bot of this.bots) {
      bot.socket = null
    }
  }
}

let counter = 0
const listeners: Record<number, (response: Response) => void> = {}

export function accept(this: Adapter<BotConfig, AdapterConfig>, bot: CQBot) {
  bot.socket.on('message', (data) => {
    data = data.toString()
    let parsed: any
    try {
      parsed = JSON.parse(data)
    } catch (error) {
      return logger.warn('cannot parse message', data)
    }

    if ('post_type' in parsed) {
      logger.debug('receive %o', parsed)
      const session = adaptSession(parsed)
      if (session) bot.adapter.dispatch(new Session(bot, session))
    } else if (parsed.echo === -1) {
      Object.assign(bot, adaptUser(camelCase(parsed.data)))
      logger.debug('%d got self info', parsed.data)
      if (bot.config.endpoint) {
        logger.info('connected to %c', bot.config.endpoint)
      }
      bot.resolve()
    } else if (parsed.echo in listeners) {
      listeners[parsed.echo](parsed)
      delete listeners[parsed.echo]
    }
  })

  bot.socket.on('close', () => {
    delete bot._request
  })

  bot.socket.send(JSON.stringify({
    action: 'get_login_info',
    echo: -1,
  }), (error) => {
    if (error) bot.reject(error)
  })

  bot._request = (action, params) => {
    const data = { action, params, echo: ++counter }
    data.echo = ++counter
    return new Promise((resolve, reject) => {
      listeners[data.echo] = resolve
      setTimeout(() => {
        delete listeners[data.echo]
        reject(new Error('response timeout'))
      }, this.config.responseTimeout || Time.minute)
      bot.socket.send(JSON.stringify(data), (error) => {
        if (error) reject(error)
      })
    })
  }
}
