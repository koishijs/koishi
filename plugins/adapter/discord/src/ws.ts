import { Adapter, Context, Logger, renameProperty } from 'koishi'
import { GatewayOpcode, GatewayPayload, GatewayIntent } from './types'
import { adaptSession, adaptUser, AdapterConfig } from './utils'
import { BotConfig, DiscordBot } from './bot'
import WebSocket from 'ws'

const logger = new Logger('discord')

export default class WebSocketClient extends Adapter.WebSocketClient<BotConfig, AdapterConfig> {
  static schema = BotConfig

  constructor(ctx: Context, config: AdapterConfig) {
    super(ctx, config)
    this.http = ctx.http.extend({
      endpoint: 'https://discord.com/api/v8',
      ...config.request,
    })
  }

  prepare() {
    return new WebSocket('wss://gateway.discord.gg/?v=8&encoding=json')
  }

  heartbeat(bot: DiscordBot) {
    logger.debug(`heartbeat d ${bot._d}`)
    bot.socket.send(JSON.stringify({
      op: GatewayOpcode.HEARTBEAT,
      d: bot._d,
    }))
  }

  private getIntents() {
    let intents = 0
      | GatewayIntent.GUILD_MESSAGES
      | GatewayIntent.GUILD_MESSAGE_REACTIONS
      | GatewayIntent.DIRECT_MESSAGES
      | GatewayIntent.DIRECT_MESSAGE_REACTIONS
    if (this.config.intents.members !== false) {
      intents |= GatewayIntent.GUILD_MEMBERS
    }
    return intents
  }

  accept(bot: DiscordBot) {
    if (bot._sessionId) {
      logger.debug('resuming')
      bot.socket.send(JSON.stringify({
        op: GatewayOpcode.RESUME,
        d: {
          token: bot.config.token,
          session_id: bot._sessionId,
          seq: bot._d,
        },
      }))
    }

    bot.socket.on('message', async (data) => {
      data = data.toString()
      let parsed: GatewayPayload
      try {
        parsed = JSON.parse(data)
      } catch (error) {
        return logger.warn('cannot parse message', data)
      }
      logger.debug(require('util').inspect(parsed, false, null, true))
      if (parsed.s) {
        bot._d = parsed.s
      }

      // https://discord.com/developers/docs/topics/gateway#identifying
      if (parsed.op === GatewayOpcode.HELLO) {
        bot._ping = setInterval(() => this.heartbeat(bot), parsed.d.heartbeat_interval)
        if (bot._sessionId) return
        bot.socket.send(JSON.stringify({
          op: GatewayOpcode.IDENTIFY,
          d: {
            token: bot.config.token,
            properties: {},
            compress: false,
            intents: this.getIntents(),
          },
        }))
      }

      if (parsed.op === GatewayOpcode.DISPATCH) {
        if (parsed.t === 'READY') {
          bot._sessionId = parsed.d.session_id
          const self: any = adaptUser(parsed.d.user)
          renameProperty(self, 'selfId', 'userId')
          Object.assign(bot, self)
          logger.debug('session_id ' + bot._sessionId)
          return bot.resolve()
        }
        const session = await adaptSession(bot, parsed)
        if (session) this.dispatch(session)
      }
    })

    bot.socket.on('close', () => {
      clearInterval(bot._ping)
    })
  }
}
