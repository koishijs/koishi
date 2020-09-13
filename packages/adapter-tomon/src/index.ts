import Tomon from 'tomon-sdk'
import { Bot, Server } from 'koishi-core'

export * from './api'

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    token?: string
  }

  interface Bot {
    tomon?: Tomon
  }
}

declare module 'koishi-core/dist/session' {
  interface Session {
    channelId?: number
  }
}

Server.types.tomon = class TomonServer extends Server {
  async __listen(bot: Bot) {
    const tomon = bot.tomon = new Tomon()
    await tomon.start(bot.token)
    bot.ready = true
    const selfId = bot.selfId = +tomon.discriminator
    tomon.on('MESSAGE_CREATE', async ({ d }) => {
      const userId = +d.author.discriminator
      if (userId === selfId) return
      const session = this.prepare({
        ...d,
        selfId,
        userId,
        message: d.content,
        postType: 'message',
        messageType: d['guild_id'] ? 'group' : 'private',
        groupId: d['guild_id'],
      })
      this.dispatch(session)
    })
  }

  async _listen() {
    await Promise.all(this.bots.map(bot => this.__listen(bot)))
  }

  _close() {}
}
