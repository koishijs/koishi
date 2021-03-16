import { Adapter, App, Bot, BotOptions, Random } from 'koishi-core'
import Profile from './profile'
import WebSocket from 'ws'

declare module 'koishi-core' {
  namespace Bot {
    interface Platforms {
      'sandbox': WebBot
    }
  }
}

class WebBot extends Bot<'sandbox'> {
  constructor(adapter: WebAdapter, options: BotOptions) {
    super(adapter, options)
    Profile.initBot(this)
  }

  async sendMessage(channelId: string, content: string) {
    this.socket.send({
      type: 'message',
      body: content,
    })
    return Random.uuid()
  }
}

export namespace WebAdapter {
  export interface Config {
    path?: string
  }
}

export class WebAdapter extends Adapter<'sandbox'> {
  server: WebSocket.Server

  constructor(app: App, config: WebAdapter.Config) {
    super(app, WebBot)
    this.server = new WebSocket.Server({
      path: config.path,
      server: app._httpServer,
    })
  }

  async start() {
    this.server.on('connection', async (socket) => {
      const bot = this.create({ type: 'sandbox', selfId: Random.uuid() })
      bot.socket = socket
      bot.username = '沙箱机器人'
      bot.status = Bot.Status.GOOD
      socket.on('close', () => {
        bot.dispose()
      })
      socket.on('message', (data) => {
        console.log(data)
      })
    })
  }

  stop() {
    this.server.close()
  }
}
