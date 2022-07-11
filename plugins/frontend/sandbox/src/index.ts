import { Bot, Context, Dict, observe, Random, Schema, segment, User } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'

declare module 'koishi' {
  interface User {
    sandbox: string
  }
}

declare module '@koishijs/plugin-console' {
  interface SocketHandle {
    sandbox: SandboxBot
  }

  interface Events {
    'sandbox/message'(this: SocketHandle, user: string, channel: string, content: string): void
    'sandbox/user'(this: SocketHandle, name: string, data: Partial<User>): void
  }

  namespace Console {
    interface Services {
      users: UserProvider
    }
  }
}

class SandboxBot extends Bot {
  static using = ['console'] as const

  username = 'koishi'

  constructor(public ctx: Context, config: SandboxBot.Config) {
    super(ctx, {
      platform: 'sandbox',
      selfId: 'koishi',
    })

    ctx.plugin(UserProvider)

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    ctx.console.addListener('sandbox/message', async (user, channel, content) => {
      ctx.console.ws.broadcast('sandbox', { content, user, channel })
      this.dispatch(this.session({
        userId: user,
        content,
        channelId: channel,
        guildId: channel === '@' + user ? undefined : channel,
        type: 'message',
        subtype: channel === '@' + user ? 'private' : 'group',
        author: {
          userId: user,
          username: user,
        },
      }))
    }, { authority: 4 })
  }

  async sendMessage(channel: string, content: string) {
    content = segment.transform(content, {
      image(data) {
        if (!data.url.startsWith('base64://')) return segment('image', data)
        return segment.image('data:image/png;base64,' + data.url.slice(9))
      },
    })
    this.ctx.console.ws.broadcast('sandbox', { content, user: 'Koishi', channel })
    return [Random.id()]
  }
}

namespace SandboxBot {
  export interface Config {}

  export const Config: Schema<Config> = Schema.object({})
}

export default SandboxBot

export interface Message {
  user: string
  channel: string
  content: string
}

export const words = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace',
  'Hank', 'Ivy', 'Jack', 'Kathy', 'Lily', 'Mandy', 'Nancy',
  'Oscar', 'Peggy', 'Quinn', 'Randy', 'Sandy', 'Toby',
  'Uma', 'Vicky', 'Wendy', 'Xander', 'Yvonne', 'Zoe',
]

export class UserProvider extends DataService<Dict<User>> {
  static using = ['database'] as const
  private task: Promise<Dict<User.Observed>>

  constructor(ctx: Context) {
    super(ctx, 'users')

    ctx.console.addListener('sandbox/user', async (name, data) => {
      const users = await this.get()
      if (!users[name]) {
        if (!data) return
        const user = await this.ctx.database.createUser('sandbox', name, {
          authority: 1,
          ...data,
        })
        return this.observe(user, users)
      } else if (!data) {
        delete users[name]
        this.ctx.$internal._userCache.set('sandbox', 'sandbox:' + name, null)
        return this.ctx.database.remove('user', { sandbox: name })
      }
      Object.assign(users[name], data)
      return users[name].$update()
    }, { authority: 4 })
  }

  observe(user: User, users: Dict<User.Observed>) {
    const uid = 'sandbox:' + user.sandbox
    users[user.sandbox] = observe(user, async (diff) => {
      await this.ctx.database.setUser('sandbox', user.sandbox, diff)
      this.refresh()
    })
    this.ctx.$internal._userCache.set('sandbox', uid, users[user.sandbox])
  }

  async prepare() {
    const data = await this.ctx.database.getUser('sandbox', words)
    const result: Dict<User.Observed> = {}
    for (const user of data) {
      this.observe(user, result)
    }
    return result
  }

  stop() {
    // keep user cache active until disposed
    this.ctx.$internal._userCache.delete('sandbox')
  }

  async get() {
    return this.task ||= this.prepare()
  }
}
