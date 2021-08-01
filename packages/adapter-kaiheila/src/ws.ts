import { App, Adapter, Bot, Logger, Time, trimSlash, sanitize } from 'koishi-core'
import { KaiheilaBot } from './bot'
import { adaptSession } from './utils'
import { Payload, Signal } from './types'
import WebSocket from 'ws'

const logger = new Logger('kaiheila')

const heartbeatIntervals = [6, 2, 4]

export default class WsClient extends Adapter.WsClient<'kaiheila'> {
  constructor(app: App) {
    super(app, KaiheilaBot, app.options.kaiheila)
    const config = this.app.options.kaiheila ||= {}
    config.path = sanitize(config.path || '/kaiheila')
    config.endpoint = trimSlash(config.endpoint || 'https://www.kaiheila.cn/api/v3')
  }

  async prepare(bot: KaiheilaBot) {
    const { url } = await bot.request('GET', '/gateway/index?compress=0')
    const headers = { Authorization: `Bot ${bot.token}` }
    return new WebSocket(url, { headers })
  }

  heartbeat(bot: KaiheilaBot) {
    if (!bot.socket || bot.status !== Bot.Status.GOOD) {
      clearInterval(bot._heartbeat)
      return
    }
    let trials = 0
    function send() {
      if (!bot.socket) return
      if (trials >= 2) {
        return bot.socket.close(1013)
      }
      bot.socket.send(JSON.stringify({ s: Signal.ping, sn: bot._sn }))
      bot._ping = setTimeout(send, heartbeatIntervals[trials++] * Time.second)
    }
    send()
  }

  async connect(bot: KaiheilaBot) {
    bot._sn = 0
    clearInterval(bot._heartbeat)

    return new Promise<void>((resolve) => {
      bot.socket.on('message', async (data) => {
        data = data.toString()
        let parsed: Payload
        try {
          parsed = JSON.parse(data)
        } catch (error) {
          return logger.warn('cannot parse message', data)
        }

        if (parsed.s === Signal.event) {
          bot._sn = Math.max(bot._sn, parsed.sn)
          const session = adaptSession(bot, parsed.d)
          if (session) this.dispatch(session)
        } else if (parsed.s === Signal.hello) {
          bot._heartbeat = setInterval(() => this.heartbeat(bot), Time.minute * 0.5)
          Object.assign(bot, await bot.getSelf())
          resolve()
        } else if (parsed.s === Signal.pong) {
          clearTimeout(bot._ping)
        } else if (parsed.s === Signal.resume) {
          bot.socket.close(1013)
        }
      })
    })
  }
}
