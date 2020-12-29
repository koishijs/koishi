import { App, Server } from 'koishi-core'
import { Logger, assertProperty, camelize } from 'koishi-utils'
import { createSession, KaiheilaBot } from './bot'

interface KaiheilaOptions {
  path?: string
}

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    kaiheila?: KaiheilaOptions
  }
}

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    verifyToken?: string
    token?: string
  }
}

type ChannelType = 'GROUP' | 'WEBHOOK_CHALLENGE'

enum EventType {
  text = 1,
  image = 2,
  video = 3,
  file = 4,
  audio = 8,
  markdown = 9,
  system = 255,
}

interface Payload {
  s: number
  sn?: number
  d: {
    type: EventType
    channelType: ChannelType
    challenge: string
    verifyToken: string
    targetId: string
    authorId: string
    content: string
    msgId: string
    msgTimestamp: number
    nonce: string
    extra: {
      type: string
      guildId: string
      channelName: string
      mention: []
      mentionAll: boolean
      mentionRoles: []
      mentionHere: boolean
      code: string
      author: {
        identifyNum: string
        avatar: string
        username: string
        id: string
        nickname: string
        roles: []
      }
      attachments: {
        type: string
        url: string
        name: string
        fileType: string
        size: number
        duration: number
        width: number
        height: number
      },
      body: {
        id: string
        username: string
        identifyNum: string
        online: boolean
        os: string
        status: number
        avatar: string
        mobileVerified: boolean
        nickname: string
        roles: []
        joinedAt: number
        activeTime: number
      }
    }
  }
}

const logger = new Logger('server')

Server.types.kaiheila = class HttpServer extends Server<KaiheilaBot> {
  constructor(app: App) {
    assertProperty(app.options, 'port')
    super(app, KaiheilaBot)
  }

  private async _listen(bot: KaiheilaBot) {
    bot.ready = true
  }

  async listen() {
    const { kaiheila = {} } = this.app.options
    const { path = '/' } = kaiheila
    this.app.router.post(path, (ctx) => {
      logger.debug('receive %o', ctx.request.body)
      const data = camelize<Payload>(ctx.request.body)

      const { challenge } = data.d
      ctx.body = { challenge }
      ctx.status = 200

      const bot = this.bots.find(bot => bot.verifyToken === data.d.verifyToken)
      if (!bot) return

      const meta = data.d as any
      KaiheilaBot.toMessage(meta)
      const session = createSession(this.app, {
        ...data.d,
        selfId: bot.selfId,
        eventType: 'message',
        kind: 'kaiheila',
      })

      // dispatch events
      console.log(session)
      this.dispatch(session)
    })

    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  close() {
    logger.debug('http server closing')
  }
}
