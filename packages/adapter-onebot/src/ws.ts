import { App, Adapter } from 'koishi-core'
import { CQBot } from './bot'
import WebSocket from 'ws'
import Socket from './socket'

export default class WsClient extends Adapter.WsClient<'onebot'> {
  private _channel = new Socket(this)

  constructor(app: App) {
    super(app, CQBot, app.options.onebot)
  }

  createSocket(bot: CQBot) {
    const headers: Record<string, string> = {}
    if (bot.token) headers.Authorization = `Bearer ${bot.token}`
    return new WebSocket(bot.server, { headers })
  }

  connect(bot: CQBot) {
    return this._channel.connect(bot)
  }
}
