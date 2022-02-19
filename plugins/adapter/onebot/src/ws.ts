import { Adapter, Context, Logger, Schema, Time, WebSocketLayer } from 'koishi'
import { BotConfig, OneBotBot } from './bot'
import { AdapterConfig, dispatchSession, Response } from './utils'
import WebSocket from 'ws'

const logger = new Logger('onebot')

export class WebSocketClient extends Adapter.WebSocketClient<BotConfig, AdapterConfig> {
  static schema: Schema<BotConfig> = Schema.object({
    selfId: Schema.string().description('机器人的账号。').required(),
    password: Schema.string().role('secret').description('机器人的密码。'),
    token: Schema.string().role('secret').description('发送信息时用于验证的字段，应与 OneBot 配置文件中的 access_token 保持一致。'),
    endpoint: Schema.string().role('url').description('要连接的 OneBot 服务器地址。').required(),
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
    selfId: Schema.string().description('机器人的账号。').required(),
    password: Schema.string().role('secret').description('机器人的密码。'),
  })

  public wsServer?: WebSocketLayer

  protected accept = accept

  constructor(ctx: Context, config: AdapterConfig) {
    super(ctx, config)
    const { path = '/onebot' } = config

    this.wsServer = ctx.router.ws(path, (socket, { headers }) => {
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

  connect() {}

  start() {}

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
    let parsed: any
    try {
      parsed = JSON.parse(data.toString())
    } catch (error) {
      return logger.warn('cannot parse message', data)
    }

    if ('post_type' in parsed) {
      logger.debug('receive %o', parsed)
      dispatchSession(bot, parsed)
    } else if (parsed.echo in listeners) {
      listeners[parsed.echo](parsed)
      delete listeners[parsed.echo]
    }
  })

  bot.socket.on('close', () => {
    delete bot.internal._request
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

  bot.initialize()
}
