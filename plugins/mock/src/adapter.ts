import { Adapter, Bot, Channel, Context, Session, Universal, User } from 'koishi'
import { MessageClient, MockMessenger } from './client'
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
  export interface Config {
    selfId: string
  }
}

export class MockBot extends Bot {
  constructor(ctx: Context, config: MockBot.Config) {
    super(ctx, config)
    this.platform = 'mock'
    this.selfId = config.selfId ?? DEFAULT_SELF_ID
    this.status = Universal.Status.ONLINE
    ctx.plugin(MockAdapter, this)
  }

  client(userId: string, channelId?: string) {
    return new MessageClient(this, userId, channelId)
  }

  receive(client: MessageClient, body: Partial<Universal.Event>) {
    const session = this.session(body)
    session.send = function (this: Session, fragment, options = {}) {
      options.session = this
      return new MockMessenger(client, options).send(fragment)
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

export class MockAdapter extends Adapter<MockBot> {
  public app: Context
  public webhook: Webhook

  constructor(ctx: Context, bot: MockBot) {
    super()
    this.app = ctx.root
    this.webhook = new Webhook(ctx.root)
    ctx.mock = this
  }

  async initUser(id: string, authority = 1, data?: Partial<User>) {
    await this.app.database.createUser('mock', id, { authority, ...data })
  }

  async initChannel(id: string, assignee = this.bots[0].selfId, data?: Partial<Channel>) {
    await this.app.database.createChannel('mock', id, { assignee, ...data })
  }

  client(userId: string, channelId?: string) {
    return new MessageClient(this.bots[0], userId, channelId)
  }

  session(meta: Partial<Universal.Event>) {
    return this.bots[0].session(meta)
  }
}

export namespace MockAdapter {
  export interface Config {}
}

Context.service('mock')
