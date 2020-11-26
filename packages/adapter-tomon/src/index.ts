import SocketSession from './network/session'
import { App, Server, Session } from 'koishi-core'
import { TomonBot } from './bot'
import { camelize, paramCase } from 'koishi-utils'

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
    const info = camelize(await bot.route('/auth/login').post({
      data: paramCase({ token, fullName, password }),
      auth: false,
    }))
    Object.assign(bot, info)
    bot.ready = true
    const selfId = bot.selfId = bot.discriminator
    this.app.bots[selfId] = bot

    // part 2: connect to server
    const socket = new SocketSession()
    return new Promise<void>((resolve) => {
      socket.open()
      socket.token = bot.token

      socket._emitter.once('READY', () => {
        console.log(`🤖️ Bot ${bot.name}(${bot.username}#${bot.discriminator}) is ready to work!`)
      })

      socket._emitter.on('MESSAGE_CREATE', async ({ d }) => {
        const userId = d.author.discriminator
        if (userId === selfId) return
        this.dispatch(new Session(this.app, {
          ...camelize(d),
          selfId,
          userId,
          kind: 'tomon',
          message: d.content || '', // TODO 处理表情包和图片
          postType: 'message',
          messageType: d['guild_id'] ? 'group' : 'private',
          groupId: d['guild_id'],
        }))
      })

      socket._emitter.on('NETWORK_CONNECTED', resolve)
    })
  }

  async listen() {
    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  close() {}
}
