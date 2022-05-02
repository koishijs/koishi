import { Context, Logger, Schema } from 'koishi'
import { resolve } from 'path'
import receiver, { Message, RefreshConfig } from './receiver'
import {} from '@koishijs/plugin-console'
import internal from 'stream'

export * from './receiver'

declare module 'koishi' {
  interface EventMap {
    'chat/receive'(message: Message, session: Session): void
  }
}

interface ChatPayload {
  content: string
  platform: string
  selfId: string
  channelId: string
  guildId: string
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
  'http://gchat.qpic.cn/',
  'http://c2cpicdw.qpic.cn/',
]

const defaultOptions: Config = {
  maxMessages: 1000,
}

export const name = 'chat'

export interface Config extends ClientExtension {
  refresh?: RefreshConfig
  logLevel?: number
}

export const Config = Schema.object({
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
      const { assignee } = await session.observeChannel(['assignee'])
      if (assignee !== session.selfId) return
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

    ctx.console.addListener('chat', async ({ content, platform, selfId, channelId, guildId }) => {
      if (ctx.assets) content = await ctx.assets.transform(content)
      ctx.bots.get(`${platform}:${selfId}`)?.sendMessage(channelId, content, guildId)
    }, { authority: 3 })

    ctx.on('chat/receive', async (message) => {
      Object.values(ctx.console.ws.handles).forEach((handle) => {
        handle.socket.send(JSON.stringify({ type: 'chat', body: message }))
      })
    })

    const { get } = ctx.http
    ctx.router.get(apiPath + '/assets/:url', async (ctx) => {
      if (!whitelist.some(prefix => ctx.params.url.startsWith(prefix))) {
        console.log(ctx.params.url)
        return ctx.status = 403
      }
      return ctx.body = await get<internal.Readable>(ctx.params.url, { responseType: 'stream' })
    })
  })
}
