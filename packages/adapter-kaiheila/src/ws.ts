import { App, Adapter, Logger, Time } from 'koishi-core'
import { createSession, KaiheilaBot } from './bot'
import { Payload, Signal } from './types'
import WebSocket from 'ws'

const logger = new Logger('kaiheila')

const heartbeatIntervals = [6, 2, 4]

export default class WsClient extends Adapter.WsClient<'kaiheila'> {
  constructor(app: App) {
    super(app, KaiheilaBot, app.options.kaiheila)
  }

  async createSocket(bot: KaiheilaBot) {
    const { url } = await bot.request('GET', '/gateway/index?compress=0')
    const headers = { Authorization: `Bot ${bot.token}` }
    return new WebSocket(url, { headers })
  }

  heartbeat(bot: KaiheilaBot, socket: WebSocket) {
    let trials = 0
    function send() {
      if (trials >= 2) {
        return socket.close(1013)
      }
      socket.send(JSON.stringify({ s: Signal.ping, sn: bot._sn }))
      bot._ping = setTimeout(send, heartbeatIntervals[trials++])
    }
    send()
  }

  async connect(bot: KaiheilaBot, socket: WebSocket) {
    bot._sn = 0
    bot.ready = true

    socket.on('message', (data) => {
      data = data.toString()
      let parsed: Payload
      try {
        parsed = JSON.parse(data)
      } catch (error) {
        return logger.warn('cannot parse message', data)
      }

      if (parsed.s === Signal.event) {
        bot._sn = Math.max(bot._sn, parsed.sn)
        const session = createSession(bot, parsed.d)
        if (session) this.dispatch(session)
      } else if (parsed.s === Signal.pong) {
        clearTimeout(bot._ping)
        bot._ping = setTimeout(() => this.heartbeat(bot, socket), Time.minute * 0.5)
      } else if (parsed.s === Signal.resume) {
        socket.close(1013)
      }
    })

    socket.on('close', () => {
      bot.ready = false
    })
  }
}
