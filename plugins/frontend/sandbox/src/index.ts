import { Adapter, Bot, Context, Random, Schema, segment, Session } from 'koishi'
import { SocketHandle } from '@koishijs/plugin-console'
import { resolve } from 'path'

declare module '@koishijs/plugin-console' {
  // namespace Console {
  //   interface Services {
  //     sandbox: SandboxService
  //   }
  // }

  interface SocketHandle {
    sandbox: SandboxBot
  }

  interface Events {
    'sandbox/message'(this: SocketHandle, user: string, channel: string, content: string): void
  }
}

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

interface BotConfig extends Bot.BaseConfig {
  handle: SocketHandle
}

export class SandboxBot extends Bot<BotConfig> {
  username = 'koishi'
  selfId = 'koishi'
  hidden = true
  handle: SocketHandle

  constructor(adapter: Sandbox, config: BotConfig) {
    super(adapter, config)
    this.handle = config.handle
    this.handle.socket.on('close', () => {
      delete this.handle.sandbox
      adapter.ctx.bots.remove(this.id)
    })
  }

  sync(body: Message) {
    this.handle.send({ type: 'sandbox', body })
  }

  async sendMessage(channel: string, content: string) {
    content = segment.transform(content, {
      image(data) {
        if (!data.url.startsWith('base64://')) return segment('image', data)
        return segment.image('data:image/png;base64,' + data.url.slice(9))
      },
    })
    this.sync({ content, user: 'Koishi', channel })
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
    const self = this

    this.platform = 'sandbox'
    ctx.bots.adapters.sandbox = this

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    ctx.console.addListener('sandbox/message', async function (user, channel, content) {
      const bot = this.sandbox ||= ctx.bots.create('sandbox', { handle: this }, SandboxBot)
      bot.sync({ content, user, channel })
      self.dispatch(new Session(bot, {
        platform: 'sandbox',
        userId: user,
        content,
        channelId: channel,
        guildId: channel,
        selfId: 'sandbox',
        type: 'message',
        subtype: channel === user ? 'private' : 'group',
        author: {
          userId: user,
          username: user,
        },
      }))
    }, { authority: 4 })
  }

  async stop() {
    for (const bot of this.bots) {
      delete (bot as SandboxBot).handle.sandbox
    }
  }

  async start() {}
}
