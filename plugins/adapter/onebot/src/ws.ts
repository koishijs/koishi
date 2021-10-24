import { Adapter, Logger, assertProperty, Time, Schema, Context } from 'koishi'
import { BotConfig, OneBotBot } from './bot'
import { AdapterConfig, dispatchSession, adaptUser, Response } from './utils'
import WebSocket from 'ws'

const logger = new Logger('onebot')

export class WebSocketClient extends Adapter.WebSocketClient<BotConfig, AdapterConfig> {
  static schema: Schema<BotConfig> = Schema.object({
    selfId: Schema.string('机器人的账号。').required(),
    token: Schema.string('发送信息时用于验证的字段，应与 OneBot 的 access_token 配置保持一致。'),
    endpoint: Schema.string('要连接的 OneBot 服务器地址。').required(),
  })

  protected accept = accept

  prepare(bot: OneBotBot) {
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

  constructor(ctx: Context, config: AdapterConfig) {
    super(ctx, config)
    assertProperty(ctx.app.options, 'port')
    const { path = '/onebot' } = config
    this.wsServer = new WebSocket.Server({
      path,
      server: ctx.app._httpServer,
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
      this.accept(bot as OneBotBot)
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

export function accept(this: Adapter<BotConfig, AdapterConfig>, bot: OneBotBot) {
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
      dispatchSession(bot, parsed)
    } else if (parsed.echo === -1) {
      Object.assign(bot, adaptUser(parsed.data))
      logger.debug('%d got self info', parsed.data)
      bot.resolve()
    } else if (parsed.echo in listeners) {
      listeners[parsed.echo](parsed)
      delete listeners[parsed.echo]
    }
  })

  bot.socket.on('close', () => {
    delete bot.internal._request
  })

  bot.socket.send(JSON.stringify({
    action: 'get_login_info',
    echo: -1,
  }), (error) => {
    if (error) bot.reject(error)
  })

  bot.internal._request = (action, params) => {
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
