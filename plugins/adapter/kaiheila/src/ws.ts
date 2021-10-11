import { Adapter, App, Bot, Logger, Schema, Time } from 'koishi'
import { BotConfig, KaiheilaBot } from './bot'
import { adaptSession, AdapterConfig } from './utils'
import { Payload, Signal } from './types'
import WebSocket from 'ws'

const logger = new Logger('kaiheila')

const heartbeatIntervals = [6, 2, 4]

export default class WebSocketClient extends Adapter.WebSocketClient<BotConfig, AdapterConfig> {
  static schema = Schema.object({
    token: Schema.string('机器人的用户令牌。').required(),
  })

  constructor(app: App, config: AdapterConfig) {
    super(app, config)
    this.http = app.http.extend({
      endpoint: 'https://www.kaiheila.cn/api/v3',
      ...config.request,
    })
  }

  async prepare(bot: KaiheilaBot) {
    const { url } = await bot.request('GET', '/gateway/index?compress=0')
    const headers = { Authorization: `Bot ${bot.config.token}` }
    return new WebSocket(url, { headers })
  }

  heartbeat(bot: KaiheilaBot) {
    if (!bot.socket || bot.status !== 'online') {
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

  async accept(bot: KaiheilaBot) {
    bot._sn = 0
    clearInterval(bot._heartbeat)

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
        bot.resolve()
      } else if (parsed.s === Signal.pong) {
        clearTimeout(bot._ping)
      } else if (parsed.s === Signal.resume) {
        bot.socket.close(1013)
      }
    })
  }
}
