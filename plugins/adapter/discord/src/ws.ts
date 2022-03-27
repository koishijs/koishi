import { Adapter, Logger, renameProperty } from 'koishi'
import { GatewayOpcode, GatewayPayload } from './types'
import { AdapterConfig, adaptSession, adaptUser } from './utils'
import { BotConfig, DiscordBot } from './bot'
import WebSocket from 'ws'

const logger = new Logger('discord')

export default class WebSocketClient extends Adapter.WebSocketClient<BotConfig, AdapterConfig> {
  static schema = BotConfig

  prepare(bot: DiscordBot) {
    return new WebSocket(bot.config.gateway)
  }

  heartbeat(bot: DiscordBot) {
    logger.debug(`heartbeat d ${bot._d}`)
    bot.socket.send(JSON.stringify({
      op: GatewayOpcode.HEARTBEAT,
      d: bot._d,
    }))
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
      bot.resolve()
    }

    bot.socket.on('message', async (data) => {
      let parsed: GatewayPayload
      try {
        parsed = JSON.parse(data.toString())
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
            intents: bot.getIntents(),
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
