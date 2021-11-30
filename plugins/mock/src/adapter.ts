import { Adapter, App, Bot, Context, Schema, Session } from 'koishi'
import { Client } from './client'
import { Webhook } from './webhook'

declare module 'koishi' {
  namespace Context {
    interface Services {
      mock: MockAdapter
    }
  }

  interface User {
    mock: string
  }
}

export const DEFAULT_SELF_ID = '514'

interface BotConfig extends Bot.BaseConfig {
  selfId: string
}

export class MockBot extends Bot<BotConfig> {
  constructor(adapter: MockAdapter, config: BotConfig) {
    super(adapter, config)
    this.selfId = config.selfId
    this.status = 'online'
  }

  async getMessage(channelId: string, messageId: string) {
    return {
      messageId,
      channelId,
      content: '',
      time: 0,
      subtype: null,
      messageType: null,
      author: { userId: this.selfId } as Bot.Author,
    }
  }
}

export class MockAdapter extends Adapter<BotConfig> {
  public app: App
  public webhook: Webhook
  public platform = 'mock'

  constructor(ctx: Context, config: MockAdapter.Config) {
    super(ctx, config)
    this.app = ctx.app
    this.app.isActive = true
    ctx.mock = this
    ctx.bots.adapters.mock = this

    for (const selfId of config.selfIds) {
      this.bot(selfId)
    }
  }

  bot(selfId = DEFAULT_SELF_ID) {
    const bot = this.bots.find(bot => bot.selfId === selfId)
    if (bot) return bot

    this.ctx.bots.create('mock', { selfId }, MockBot)
    return this.bots.find(bot => bot.selfId === selfId)
  }

  connect() {}

  stop() {}

  start() {}

  async initUser(id: string, authority = 1) {
    await this.app.database.create('user', { mock: id, authority })
  }

  async initChannel(id: string, assignee = this.bots[0].selfId) {
    await this.app.database.create('channel', { platform: 'mock', id, assignee })
  }

  client(userId: string, channelId?: string) {
    return new Client(this, userId, channelId)
  }

  session(meta: Partial<Session>) {
    return new Session(this.bots[0], meta)
  }

  receive(meta: Partial<Session>) {
    const session = this.session(meta)
    this.dispatch(session)
    return session.id
  }
}

export namespace MockAdapter {
  export interface Config {
    selfIds?: string[]
  }
  
  export const Config = Schema.object({
    selfIds: Schema.array(Schema.string()).default([DEFAULT_SELF_ID]),
  })
}

Context.service('mock')
