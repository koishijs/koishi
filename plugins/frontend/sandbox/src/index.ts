import { Adapter, Bot, Context, Random, Schema, segment, Session } from 'koishi'
import {} from '@koishijs/plugin-console'
import { resolve } from 'path'

declare module '@koishijs/plugin-console' {
  interface SocketHandle {
    sandbox: SandboxBot
  }

  interface Events {
    'sandbox/message'(this: SocketHandle, user: string, channel: string, content: string): void
  }
}

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export class SandboxBot extends Bot {
  username = 'koishi'
  selfId = 'koishi'
  hidden = true

  constructor(public adapter: Sandbox, config: Bot.BaseConfig) {
    super(adapter, config)
  }

  async sendMessage(channel: string, content: string) {
    content = segment.transform(content, {
      image(data) {
        if (!data.url.startsWith('base64://')) return segment('image', data)
        return segment.image('data:image/png;base64,' + data.url.slice(9))
      },
    })
    this.adapter.broadcast({ content, user: 'Koishi', channel })
    return [Random.id()]
  }
}

export interface Message {
  user: string
  channel: string
  content: string
}

export default class Sandbox extends Adapter {
  static using = ['console'] as const
  static schema: Schema<Config> = Schema.object({})

  constructor(ctx: Context, config: Config) {
    super(ctx, config)

    this.platform = 'sandbox'
    ctx.bots.adapters.sandbox = this
    const bot = ctx.bots.create('sandbox', {}, SandboxBot)

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    ctx.console.addListener('sandbox/message', async (user, channel, content) => {
      this.broadcast({ content, user, channel })
      this.dispatch(new Session(bot, {
        platform: 'sandbox',
        userId: user,
        content,
        channelId: channel,
        guildId: channel,
        selfId: 'sandbox',
        type: 'message',
        subtype: channel === '@' + user ? 'private' : 'group',
        author: {
          userId: user,
          username: user,
        },
      }))
    }, { authority: 4 })
  }

  broadcast(body: Message) {
    this.ctx.console.ws.broadcast('sandbox', body)
  }

  async start() {}

  async stop() {}
}
