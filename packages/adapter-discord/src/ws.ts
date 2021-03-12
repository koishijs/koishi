import { App, Adapter, Logger, renameProperty } from 'koishi-core'
import { Opcode, Payload } from './types'
import { adaptSession, adaptUser } from './utils'
import { DiscordBot } from './bot'
import WebSocket from 'ws'

const logger = new Logger('discord')

// https://discord.com/developers/docs/topics/gateway
export default class WsClient extends Adapter.WsClient<'discord'> {
  constructor(app: App) {
    super(app, DiscordBot, app.options.discord)
  }

  async prepare() {
    return new WebSocket('wss://gateway.discord.gg/?v=8&encoding=json')
  }

  heartbeat(bot: DiscordBot) {
    logger.debug(`heartbeat d ${bot._d}`)
    bot.socket.send(JSON.stringify({
      op: Opcode.Heartbeat,
      d: bot._d,
    }))
  }

  async connect(bot: DiscordBot) {
    return new Promise<void>((resolve) => {
      if (bot._sessionId) {
        logger.info('resuming')
        bot.socket.send(JSON.stringify({
          op: Opcode.Resume,
          d: {
            token: bot.token,
            session_id: bot._sessionId,
            seq: bot._d,
          },
        }))
      }

      bot.socket.on('message', async (data) => {
        data = data.toString()
        let parsed: Payload
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
        if (parsed.op === Opcode.Hello) {
          bot._ping = setInterval(() => this.heartbeat(bot), parsed.d.heartbeat_interval)
          bot.socket.send(JSON.stringify({
            op: Opcode.Identify,
            d: {
              token: bot.token,
              properties: {},
              compress: false,
              intents: (1 << 9) + (1 << 12),
            },
          }))
        } else if (parsed.op === Opcode.Dispatch) {
          if (parsed.t === 'READY') {
            bot._sessionId = parsed.d.session_id
            const self: any = adaptUser(parsed.d.user)
            renameProperty(self, 'selfId', 'userId')
            Object.assign(bot, self)
            logger.debug('session_id ' + bot._sessionId)
            resolve()
          }
          const session = await adaptSession(bot, parsed)
          if (session) this.dispatch(session)
        }
      })

      bot.socket.on('close', () => {
        clearInterval(bot._ping)
      })
    })
  }
}
