import { Adapter, Bot, Channel, Context, Session, User } from 'koishi'
import { MessageClient } from './client'
import { Webhook } from './webhook'

declare module 'koishi' {
  interface Context {
    mock: MockAdapter
  }

  interface User {
    mock: string
  }
}

export const DEFAULT_SELF_ID = '514'

export namespace MockBot {
  export interface Config extends Bot.Config {
    selfId: string
  }
}

export class MockBot extends Bot {
  constructor(ctx: Context, config: MockBot.Config) {
    super(ctx, config)
    this.selfId = config.selfId ?? DEFAULT_SELF_ID
    this.status = 'online'
    ctx.plugin(MockAdapter, this)
  }

  client(userId: string, channelId?: string) {
    return new MessageClient(this, userId, channelId)
  }

  receive(meta: Partial<Session>) {
    const session = this.session(meta)
    this.dispatch(session)
    return session.id
  }

  async getMessage(channelId: string, messageId: string) {
    return {
      messageId,
      channelId,
      content: '',
      time: 0,
      subtype: null,
      messageType: null,
      author: { userId: this.selfId },
    }
  }
}

MockBot.prototype.platform = 'mock'

export class MockAdapter extends Adapter.Server<MockBot> {
  public app: Context
  public webhook: Webhook

  constructor(ctx: Context, bot: MockBot) {
    super()
    this.app = ctx.root
    this.webhook = new Webhook(ctx.root)
    ctx.mock = this
  }

  async initUser(id: string, authority = 1, data?: Partial<User>) {
    await this.app.database.create('user', { mock: id, authority, ...data })
  }

  async initChannel(id: string, assignee = this.bots[0].selfId, data?: Partial<Channel>) {
    await this.app.database.create('channel', { platform: 'mock', id, assignee, ...data })
  }

  client(userId: string, channelId?: string) {
    return new MessageClient(this.bots[0], userId, channelId)
  }

  session(meta: Partial<Session>) {
    return this.bots[0].session(meta)
  }

  receive(meta: Partial<Session>) {
    return this.bots[0].receive(meta)
  }
}

export namespace MockAdapter {
  export interface Config {}
}

Context.service('mock')
