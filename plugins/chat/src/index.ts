import { Adapter, Bot, Context, Random, segment, Session, template } from 'koishi'
import { resolve } from 'path'
import { WebServer } from '@koishijs/plugin-webui'
import receiver, { Message, ReceiverConfig } from './receiver'
import axios from 'axios'

export * from './receiver'

declare module 'koishi' {
  interface EventMap {
    'chat/receive'(message: Message, session: Session): void
  }

  namespace Bot {
    interface Platforms {
      'webui': SandboxBot
    }
  }
}

declare module '@koishijs/plugin-webui' {
  interface ClientConfig extends ClientExtension {}
}

interface ClientExtension {
  whitelist?: string[]
  maxMessages?: number
}

export interface Config extends ReceiverConfig, ClientExtension {}

template.set('chat', {
  send: '[{{ channelName || "私聊" }}] {{ abstract }}',
  receive: '[{{ channelName || "私聊" }}] {{ username }}: {{ abstract }}',
})

export class SandboxBot extends Bot<'webui'> {
  username = 'sandbox'
  status = Bot.Status.GOOD

  constructor(public readonly adapter: WebServer & Adapter<'webui'>) {
    super(adapter, { type: 'webui', selfId: 'sandbox' })
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

export function apply(ctx: Context, options: Config = {}) {
  options = { ...defaultOptions, ...options }
  ctx.plugin(receiver, options)

  ctx.on('chat/receive', async (message, session) => {
    if (session.subtype !== 'private') {
      const { assignee } = await session.observeChannel(['assignee'])
      if (assignee !== session.selfId) return
    }
    ctx.logger('message').debug(template('chat.' + (session.type === 'message' ? 'receive' : 'send'), message))
  })

  ctx.with(['@koishijs/plugin-webui'] as const, (ctx, { Profile }) => {
    const { devMode, apiPath } = ctx.webui.config
    const filename = devMode ? '../client/index.ts' : '../dist/index.js'
    const whitelist = [...builtinWhitelist, ...options.whitelist || []]

    ctx.webui.global.whitelist = whitelist
    ctx.webui.global.maxMessages = options.maxMessages
    ctx.webui.addEntry(resolve(__dirname, filename))

    ctx.webui.addListener('chat', async function ({ id, token, content, platform, selfId, channelId, guildId }) {
      const user = await this.validate(id, token, ['name', 'authority'])
      if (!user) return
      if (user.authority < 4) return this.send('unauthorized')
      content = await ctx.transformAssets(content)
      ctx.bots[`${platform}:${selfId}`]?.sendMessage(channelId, content, guildId)
    })

    ctx.on('connect', () => {
      // create bot after connection
      // to prevent mysql from altering user table
      const sandbox = ctx.webui.create({}, SandboxBot)
      Profile.initBot(sandbox)
    })

    ctx.webui.addListener('sandbox', async function ({ id, token, content }) {
      const user = await this.validate(id, token, ['name'])
      if (!user) return
      content = await ctx.transformAssets(content)
      this.send('sandbox:user', content)
      const session = new Session(ctx.app, {
        platform: 'webui',
        userId: id,
        content,
        channelId: this.id,
        selfId: 'sandbox',
        type: 'message',
        subtype: 'private',
        author: {
          userId: 'id',
          username: user.name,
        },
      })
      session.platform = 'id' as never
      ctx.webui.dispatch(session)
    })

    ctx.self('sandbox')
      .command('clear', '清空消息列表')
      .action(({ session }) => {
        ctx.webui.handles[session.channelId].send('sandbox:clear')
      })

    ctx.on('chat/receive', async (message) => {
      Object.values(ctx.webui.handles).forEach((handle) => {
        if (handle.authority >= 4) handle.socket.send(JSON.stringify({ type: 'chat', body: message }))
      })
    })

    ctx.router.get(apiPath + '/assets/:url', async (ctx) => {
      if (!whitelist.some(prefix => ctx.params.url.startsWith(prefix))) {
        console.log(ctx.params.url)
        return ctx.status = 403
      }
      const { data } = await axios.get(ctx.params.url, { responseType: 'stream' })
      return ctx.body = data
    })
  })
}
