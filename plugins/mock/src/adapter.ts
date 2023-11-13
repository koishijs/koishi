import { Adapter, Bot, Channel, Context, Session, Universal, User } from 'koishi'
import { MessageClient, MockMessenger } from './client'
import { Webhook } from './webhook'

declare module 'koishi' {
  interface Context {
    mock: MockAdapter<this>
  }

  interface User {
    mock: string
  }
}

export const DEFAULT_SELF_ID = '514'

export namespace MockBot {
  export interface Config {
    selfId: string
  }
}

export class MockBot<C extends Context = Context> extends Bot<C> {
  constructor(ctx: C, config: MockBot.Config) {
    super(ctx, config)
    this.platform = 'mock'
    this.selfId = config.selfId ?? DEFAULT_SELF_ID
    this.status = Universal.Status.ONLINE
    ctx.plugin(MockAdapter, this)
  }

  client(userId: string, channelId?: string) {
    return new MessageClient(this, userId, channelId)
  }

  receive(event: Partial<Universal.Event>, client?: MessageClient) {
    const session = this.session(event)
    session.send = async function (this: Session, fragment, options = {}) {
      options.session = this
      const messages = await new MockMessenger(client, options).send(fragment)
      return messages.map(messages => messages.id)
    }
    this.dispatch(session)
    return session.id
  }

  async getMessage(channelId: string, id: string) {
    const isDirect = channelId.startsWith('private:')
    return {
      id,
      messageId: id,
      channel: { id: channelId, type: isDirect ? Universal.Channel.Type.DIRECT : Universal.Channel.Type.TEXT },
      content: '',
      time: 0,
      user: { id: this.selfId },
    }
  }
}

export class MockAdapter<C extends Context = Context> extends Adapter<C, MockBot<C>> {
  public root: Context
  public webhook: Webhook

  constructor(ctx: C, bot: MockBot<C>) {
    super(ctx)
    this.root = ctx.root
    this.webhook = new Webhook(ctx.root)
    this.root.provide('mock', this, true)
  }

  async initUser(id: string, authority = 1, data?: Partial<User>) {
    await this.root.database.createUser('mock', id, { authority, ...data })
  }

  async initChannel(id: string, assignee = this.bots[0].selfId, data?: Partial<Channel>) {
    await this.root.database.createChannel('mock', id, { assignee, ...data })
  }

  client(userId: string, channelId?: string) {
    return this.bots[0].client(userId, channelId)
  }

  receive(event: Partial<Universal.Event>, client?: MessageClient) {
    return this.bots[0].receive(event, client)
  }

  session(event: Partial<Universal.Event>) {
    return this.bots[0].session(event)
  }
}

export namespace MockAdapter {
  export interface Config {}
}
