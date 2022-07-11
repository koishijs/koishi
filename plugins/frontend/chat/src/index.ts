import { Context, Logger, Schema, segment } from 'koishi'
import { resolve } from 'path'
import receiver, { Message, RefreshConfig } from './receiver'
import {} from '@koishijs/plugin-console'
import internal from 'stream'

export * from './receiver'

declare module 'koishi' {
  interface Events {
    'chat/receive'(message: Message, session: Session): void
  }
}

interface ChatPayload {
  content: string
  platform: string
  channelId: string
  guildId: string
  selfId: string
}

declare module '@koishijs/plugin-console' {
  interface ClientConfig extends ClientExtension {}

  interface Events {
    chat(message: ChatPayload): Promise<void>
  }
}

interface ClientExtension {
  whitelist?: string[]
  maxMessages?: number
}

const builtinWhitelist = [
  'https://gchat.qpic.cn/',
  'https://c2cpicdw.qpic.cn/',
]

const defaultOptions: Config = {
  maxMessages: 1000,
}

export const name = 'chat'

export const using = ['database'] as const

export interface Config extends ClientExtension {
  refresh?: RefreshConfig
  logLevel?: number
}

export const Config: Schema<Config> = Schema.object({
  whitelist: Schema.array(String),
  maxMessages: Schema.natural(),
  logLevel: Schema.natural().max(3),
  refresh: RefreshConfig,
})

const logger = new Logger('message')

export function apply(ctx: Context, options: Config = {}) {
  ctx.i18n.define('zh', require('./locales/zh'))

  options = { ...defaultOptions, ...options }
  ctx.plugin(receiver, options.refresh)

  logger.level = options.logLevel || 3

  ctx.on('chat/receive', async (message, session) => {
    if (session.subtype !== 'private' && ctx.database) {
      const channel = await ctx.database.getChannel(session.platform, session.channelId, ['assignee'])
      if (!channel || channel.assignee !== session.selfId) return
    }

    // render template with fallback options
    let templatePath = 'chat.log.' + (session.type === 'message' ? 'receive' : 'send')
    if (!message.channelName) templatePath += '-fallback'
    logger.debug(session.text(templatePath, message))
  })

  ctx.using(['console'], (ctx) => {
    const { apiPath } = ctx.console.config
    const whitelist = [...builtinWhitelist, ...options.whitelist || []]

    ctx.console.global.whitelist = whitelist
    ctx.console.global.maxMessages = options.maxMessages

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    ctx.console.addListener('chat', async ({ content, platform, channelId, guildId, selfId }) => {
      if (ctx.assets) content = await ctx.assets.transform(content)
      ctx.bots[`${platform}:${selfId}`]?.sendMessage(channelId, content, guildId)
    }, { authority: 3 })

    ctx.on('chat/receive', async (message) => {
      message.content = segment.transform(message.content, {
        image: (data) => {
          if (whitelist.some(prefix => data.url.startsWith(prefix))) {
            data.url = apiPath + '/proxy/' + encodeURIComponent(data.url)
          }
          return segment('image', data)
        },
      })
      Object.values(ctx.console.ws.handles).forEach((handle) => {
        handle.socket.send(JSON.stringify({ type: 'chat', body: message }))
      })
    })

    const { get } = ctx.http
    ctx.router.get(apiPath + '/proxy/:url', async (ctx) => {
      if (!whitelist.some(prefix => ctx.params.url.startsWith(prefix))) {
        return ctx.status = 403
      }
      return ctx.body = await get<internal.Readable>(ctx.params.url, { responseType: 'stream' })
    })
  })
}
