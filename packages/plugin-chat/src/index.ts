import { Context, template } from 'koishi-core'
import { resolve } from 'path'
import {} from 'koishi-plugin-webui'
import receiver, { Message, ReceiverConfig } from './receiver'

export * from './receiver'

declare module 'koishi-core' {
  interface EventMap {
    'chat/receive'(message: Message, session: Session): void
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

  ctx.with(['koishi-plugin-webui'] as const, (ctx) => {
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

    ctx.on('chat/receive', (message) => {
      Object.values(ctx.webui.adapter.handles).forEach((handle) => {
        if (handle.authority >= 4) handle.socket.send(JSON.stringify({ type: 'chat', body: message }))
      })
    })
  })
}
