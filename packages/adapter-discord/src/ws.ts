import { App, Adapter, Logger } from 'koishi-core'
import { DiscordBot } from './bot'
import WebSocket from 'ws'
import { Opcode, Payload } from './types'

import { adaptSession } from './utils'

const logger = new Logger('discord')

export default class WsClient extends Adapter.WsClient<'discord'> {
  constructor(app: App) {
    super(app, DiscordBot, app.options.discord)
  }

  async prepare(bot: DiscordBot) {
    return new WebSocket('wss://gateway.discord.gg/?v=8&encoding=json')
  }

  heartbeat(bot: DiscordBot) {
    bot.socket.send(JSON.stringify({
      op: Opcode.Heartbeat,
      d: bot._d,
    }))
  }

  async connect(bot: DiscordBot) {
    bot._d = 0
    bot.ready = true

    bot.socket.on('message', (data) => {
      data = data.toString()
      let parsed: Payload
      try {
        parsed = JSON.parse(data)
      } catch (error) {
        return logger.warn('cannot parse message', data)
      }
      console.log(parsed)
      if (parsed.op === Opcode.Hello) {
        bot._ping = setInterval(() => this.heartbeat(bot), parsed.d.heartbeat_interval)
        bot.socket.send(JSON.stringify({
          op: Opcode.Identify,
          d: {
            token: bot.token,
            properties: {},
            compress: false,
            intents: 1 << 9,
          },
        }))
      } else if (parsed.op === Opcode.HeartbeatACK) {
        return
      } else if (parsed.op === Opcode.Dispatch) {
        if (parsed.d?.author?.id !== bot.selfId) {
          const session = adaptSession(bot, parsed)
          if (session) this.dispatch(session)
        }
      }
      bot._d = parsed.s
    })

    bot.socket.on('close', (c, r) => {
      bot.ready = false
      logger.warn(r)
      clearInterval(bot._ping)
    })
  }
}
