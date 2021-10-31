import { Bot, Context, Logger, Random, Schema, segment, Session, template, Time } from 'koishi'
import { resolve } from 'path'
import { StatusServer } from '@koishijs/plugin-status'
import receiver, { Message, RefreshConfig } from './receiver'

export * from './receiver'

declare module 'koishi' {
  interface EventMap {
    'chat/receive'(message: Message, session: Session): void
  }

  interface Modules {
    chat: typeof import('.')
  }
}

declare module '@koishijs/plugin-status' {
  interface ClientConfig extends ClientExtension {}
}

interface ClientExtension {
  whitelist?: string[]
  maxMessages?: number
}

export interface Config extends ClientExtension {
  refresh?: RefreshConfig
  logLevel?: number
}

template.set('chat', {
  send: '[{{ channelName || "私聊" }}] {{ abstract }}',
  receive: '[{{ channelName || "私聊" }}] {{ username }}: {{ abstract }}',
})

export class SandboxBot extends Bot {
  username = 'sandbox'

  constructor(public readonly adapter: StatusServer) {
    super(adapter, {})
    this.selfId = 'sandbox'
    this.status = 'online'
  }

  async sendMessage(id: string, content: string) {
    content = segment.transform(content, {
      image(data) {
        if (!data.url.startsWith('base64://')) return segment('image', data)
        return segment.image('data:image/png;base64,' + data.url.slice(9))
      },
    })
    this.adapter.handles[id]?.send('sandbox:bot', content)
    return Random.id()
  }
}

const builtinWhitelist = [
  'http://gchat.qpic.cn/',
  'http://c2cpicdw.qpic.cn/',
]

const defaultOptions: Config = {
  maxMessages: 1000,
}

export const name = 'chat'

export const schema: Schema<Config> = Schema.object({
  refresh: Schema.object({
    user: Schema.number('刷新用户数据的时间间隔。').default(Time.hour),
    guild: Schema.number('刷新群组数据的时间间隔。').default(Time.hour),
    channel: Schema.number('刷新频道数据的时间间隔。').default(Time.hour),
  }, '刷新选项'),
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

  ctx.with(['status'], (ctx, { status }) => {
    const { devMode, apiPath } = ctx.webui.config
    const filename = devMode ? '../client/index.ts' : '../dist/index.js'
    const whitelist = [...builtinWhitelist, ...options.whitelist || []]

    ctx.webui.global.whitelist = whitelist
    ctx.webui.global.maxMessages = options.maxMessages
    ctx.webui.addEntry(resolve(__dirname, filename))

    ctx.on('connect', async () => {
      // create bot after connection
      // to prevent mysql from altering user table
      const sandbox = await ctx.bots.create('status', { platform: 'id' }, SandboxBot)

      ctx.webui.addListener('chat', async function ({ content, platform, selfId, channelId, guildId }) {
        if (await this.validate()) return this.send('unauthorized')
        if (ctx.assets) content = await ctx.assets.transform(content)
        ctx.bots.get(`${platform}:${selfId}`)?.sendMessage(channelId, content, guildId)
      })

      ctx.webui.addListener('sandbox', async function ({ id, content }) {
        if (await this.validate()) return this.send('unauthorized')
        if (ctx.assets) content = await ctx.assets.transform(content)
        this.send('sandbox:user', content)
        ctx.webui.dispatch(new Session(sandbox, {
          userId: id,
          content,
          channelId: this.id,
          selfId: 'sandbox',
          type: 'message',
          subtype: 'private',
          author: {
            userId: 'id',
            username: id,
          },
        }))
      })
    })

    ctx.self('sandbox')
      .command('clear', '清空消息列表')
      .action(({ session }) => {
        ctx.webui.handles[session.channelId].send('sandbox:clear')
      })

    ctx.on('chat/receive', async (message) => {
      Object.values(ctx.webui.handles).forEach((handle) => {
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
