import { Bot, Context, Random, Session, template } from 'koishi-core'
import { resolve } from 'path'
import { WebServer } from 'koishi-plugin-webui'
import receiver, { Message, ReceiverConfig } from './receiver'

export * from './receiver'

declare module 'koishi-core' {
  interface EventMap {
    'chat/receive'(message: Message, session: Session): void
  }

  namespace Bot {
    interface Platforms {
      'web': SandboxBot
    }
  }
}

export interface Config extends ReceiverConfig {
  includeUsers?: string[]
  includeChannels?: string[]
}

template.set('chat', {
  send: '[{{ channelName || "私聊" }}] {{ abstract }}',
  receive: '[{{ channelName || "私聊" }}] {{ username }}: {{ abstract }}',
})

export class SandboxBot extends Bot<'web'> {
  username = 'sandbox'
  status = Bot.Status.GOOD

  constructor(public readonly adapter: WebServer) {
    super(adapter, { type: 'web', selfId: 'sandbox' })
  }

  async sendMessage(id: string, content: string) {
    this.adapter.handles[id]?.send('sandbox:bot', content)
    return Random.uuid()
  }
}

export const name = 'chat'

export function apply(ctx: Context, options: Config = {}) {
  const { includeUsers, includeChannels } = options

  ctx.plugin(receiver, options)

  ctx.on('chat/receive', async (message, session) => {
    if (session.subtype === 'private') {
      if (includeUsers && !includeUsers.includes(session.userId)) return
    } else {
      if (includeChannels && !includeChannels.includes(session.channelId)) return
      const { assignee } = await session.observeChannel(['assignee'])
      if (assignee !== session.selfId) return
    }
    ctx.logger('message').debug(template('chat.' + (session.type === 'message' ? 'receive' : 'send'), message))
  })

  ctx.with(['koishi-plugin-webui'] as const, (ctx, { Profile }) => {
    const { devMode } = ctx.webui.config
    const filename = devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.webui.addEntry(resolve(__dirname, filename))

    ctx.webui.addListener('chat', async function ({ id, token, content, platform, selfId, channelId }) {
      const user = await this.validate(id, token, ['name', 'authority'])
      if (!user) return
      if (user.authority < 4) return this.send('unauthorized')
      content = await ctx.transformAssets(content)
      ctx.bots[`${platform}:${selfId}`]?.sendMessage(channelId, content)
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
        platform: 'web',
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
        this.handles[session.channelId].send('sandbox:clear')
      })

    ctx.on('chat/receive', async (message) => {
      Object.values(ctx.webui.handles).forEach((handle) => {
        if (handle.authority >= 4) handle.socket.send(JSON.stringify({ type: 'chat', body: message }))
      })
    })
  })
}
