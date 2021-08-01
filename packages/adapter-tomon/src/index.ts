import { Session as SocketSession } from './network/session'
import { App, Adapter, Session, camelize } from 'koishi-core'
import { TomonBot, TomonMessageInfo } from './bot'

export * from './bot'

declare module 'koishi-core' {
  interface BotOptions {
    token?: string
    fullName?: string
    password?: string
  }

  namespace Bot {
    interface Platforms {
      tomon: TomonBot
    }
  }
}

Adapter.types.tomon = class TomonServer extends Adapter<'tomon'> {
  constructor(app: App) {
    super(app, TomonBot)
  }

  async _listen(bot: TomonBot) {
    // part 1: authorization
    const { token, fullName, password } = bot
    const info = await bot.request('POST', '/auth/login', {
      data: { token, fullName, password },
      auth: false,
    })
    Object.assign(bot, info)
    const selfId = bot.selfId = bot.id

    // part 2: connect to server
    return new Promise<void>((resolve) => {
      const socket = new SocketSession()
      socket.token = bot.token
      socket.open()

      socket._emitter.once('READY', () => {
        console.log(`Bot ${bot.name}(${bot.username}#${bot.discriminator}) is ready to work!`)
        resolve()
      })

      const dispatchMessage = (data: TomonMessageInfo, type: keyof Session.Events) => {
        TomonBot.toMessage(data = camelize(data))
        const userId = data.author.id
        if (userId === selfId) return
        // TODO: 处理图片和表情
        if (!data.content) data.content = ''
        this.dispatch(new Session(this.app, {
          ...data,
          selfId,
          userId,
          type,
          platform: 'tomon',
          channelId: data['guildId'],
          subtype: data['guildId'] ? 'group' : 'private',
          author: data.author,
        }))
      }

      socket._emitter.on('MESSAGE_CREATE', async ({ d }) => dispatchMessage(d, 'message'))
      socket._emitter.on('MESSAGE_UPDATE', async ({ d }) => dispatchMessage(d, 'message-updated'))
      socket._emitter.on('MESSAGE_DELETE', async ({ d }) => dispatchMessage(d, 'message-deleted'))
    })
  }

  async start() {
    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  stop() {}
}
