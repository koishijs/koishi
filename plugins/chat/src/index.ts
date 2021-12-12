import { Context, Logger, Schema, template } from 'koishi'
import { resolve } from 'path'
import receiver, { Message, RefreshConfig } from './receiver'
import {} from '@koishijs/plugin-console'

export * from './receiver'

declare module 'koishi' {
  interface EventMap {
    'chat/receive'(message: Message, session: Session): void
  }

  interface Modules {
    chat: typeof import('.')
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

  namespace Console {
    interface Events {
      chat(message: ChatPayload): Promise<void>
    }
  }
}

interface ClientExtension {
  whitelist?: string[]
  maxMessages?: number
}

template.set('chat', {
  send: '[{{ channelName || "私聊" }}] {{ abstract }}',
  receive: '[{{ channelName || "私聊" }}] {{ username }}: {{ abstract }}',
})

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
  refresh: RefreshConfig,
  whitelist: Schema.array(Schema.string()),
  maxMessages: Schema.number(),
  logLevel: Schema.number(),
})

const logger = new Logger('message')

export function apply(ctx: Context, options: Config = {}) {
  options = { ...defaultOptions, ...options }
  ctx.plugin(receiver, options.refresh)

  logger.level = options.logLevel || 3

  ctx.on('chat/receive', async (message, session) => {
    if (session.subtype !== 'private' && ctx.database) {
      const { assignee } = await session.observeChannel(['assignee'])
      if (assignee !== session.selfId) return
    }
    logger.debug(template('chat.' + (session.type === 'message' ? 'receive' : 'send'), message))
  })

  ctx.using(['console'], (ctx) => {
    const { devMode, apiPath } = ctx.console.config
    const filename = devMode ? '../client/index.ts' : '../dist/index.js'
    const whitelist = [...builtinWhitelist, ...options.whitelist || []]

    ctx.console.global.whitelist = whitelist
    ctx.console.global.maxMessages = options.maxMessages
    ctx.console.addEntry(resolve(__dirname, filename))

    ctx.console.addListener('chat', async ({ content, platform, selfId, channelId, guildId }) => {
      if (ctx.assets) content = await ctx.assets.transform(content)
      ctx.bots.get(`${platform}:${selfId}`)?.sendMessage(channelId, content, guildId)
    })

    ctx.on('chat/receive', async (message) => {
      Object.values(ctx.console.handles).forEach((handle) => {
        handle.socket.send(JSON.stringify({ type: 'chat', body: message }))
      })
    })

    const { get } = ctx.http
    ctx.router.get(apiPath + '/assets/:url', async (ctx) => {
      if (!whitelist.some(prefix => ctx.params.url.startsWith(prefix))) {
        console.log(ctx.params.url)
        return ctx.status = 403
      }
      return ctx.body = await get.stream(ctx.params.url)
    })
  })
}
