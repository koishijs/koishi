import { Adapter, Bot, BotOptions, Context, Logger, Random } from 'koishi-core'
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

const logger = new Logger('status')
const states: Record<string, [string, number, WebSocket]> = {}

export namespace WebAdapter {
  export interface Config {
    path?: string
    expiration?: number
  }
}

export class WebAdapter extends Adapter<'sandbox'> {
  server: WebSocket.Server

  constructor(ctx: Context, public config: WebAdapter.Config) {
    super(ctx.app, WebBot)
    this.server = new WebSocket.Server({
      path: config.path,
      server: ctx.app._httpServer,
    })

    ctx.all().middleware(async (session, next) => {
      if (session.subtype !== 'private') return next()
      const state = states[session.uid]
      if (state && state[0] === session.content) {
        return state[2].send(JSON.stringify({
          type: 'user',
          body: await session.observeUser(['id', 'name', 'authority']),
        }))
      }
      return next()
    }, true)
  }

  async start() {
    this.server.on('connection', async (socket) => {
      const bot = this.create({ type: 'sandbox', selfId: Random.uuid() })
      bot.socket = socket
      bot.username = '沙箱机器人'
      bot.status = Bot.Status.GOOD
      socket.on('close', () => {
        bot.dispose()
        for (const id in states) {
          if (states[id][2] === socket) delete states[id]
        }
      })
      socket.on('message', async (data) => {
        const { type, body } = JSON.parse(data.toString())
        if (type === 'token') {
          const { platform, userId } = body
          const user = await this.app.database.getUser(platform, userId, ['name'])
          if (!user) return socket.send(JSON.stringify({ type: 'token', body: { message: '没有此账户。' } }))
          const id = `${platform}:${userId}`
          const token = Random.uuid()
          const expire = Date.now() + this.config.expiration
          states[id] = [token, expire, socket]
          setTimeout(() => {
            if (states[id]?.[1] > Date.now()) delete states[id]
          }, this.config.expiration)
          socket.send(JSON.stringify({ type: 'token', body: { token, name: user.name } }))
        } else {
          logger.info(type, body)
        }
      })
    })
  }

  stop() {
    this.server.close()
  }
}
