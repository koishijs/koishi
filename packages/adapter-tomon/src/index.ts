import SocketSession from './network/session'
import { App, EventType, Server, Session } from 'koishi-core'
import { TomonBot, TomonMessageInfo } from './bot'
import { camelize } from 'koishi-utils'

export * from './bot'

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    token?: string
    fullName?: string
    password?: string
  }
}

Server.types.tomon = class TomonServer extends Server<TomonBot> {
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
    bot.ready = true
    const selfId = bot.selfId = bot.discriminator
    this.app.bots[selfId] = bot

    // part 2: connect to server
    return new Promise<void>((resolve) => {
      const socket = new SocketSession()
      socket.token = bot.token
      socket.open()

      socket._emitter.once('READY', () => {
        console.log(`Bot ${bot.name}(${bot.username}#${bot.discriminator}) is ready to work!`)
        resolve()
      })

      function dispatchMessage(data: TomonMessageInfo, eventType: EventType) {
        TomonBot.adaptMessage(data = camelize(data))
        const userId = data.author.discriminator
        console.log(userId, selfId)
        if (userId === selfId) return
        this.dispatch(new Session(this.app, {
          ...data,
          selfId,
          userId,
          eventType,
          kind: 'tomon',
          message: data.content || '', // TODO 处理表情包和图片
          groupId: data['guildId'],
          subType: data['guildId'] ? 'group' : 'private',
        }))
      }

      socket._emitter.on('MESSAGE_CREATE', async ({ d }) => dispatchMessage(d, 'message'))
      socket._emitter.on('MESSAGE_UPDATE', async ({ d }) => dispatchMessage(d, 'message-edited'))
      socket._emitter.on('MESSAGE_DELETE', async ({ d }) => dispatchMessage(d, 'message-deleted'))
    })
  }

  async listen() {
    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  close() {}
}
