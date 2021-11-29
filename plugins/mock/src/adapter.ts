import { Adapter, App, Bot, Context, Schema, Session } from 'koishi'
import { Client } from './client'
import { Webhook } from './webhook'
import memory from '@koishijs/plugin-database-memory'

declare module 'koishi' {
  namespace Context {
    interface Services {
      mock: Tester
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

export class TestBot extends Bot<BotConfig> {
  constructor(adapter: Tester, config: BotConfig) {
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

export class Tester extends Adapter<BotConfig> {
  public app: App
  public webhook: Webhook
  public platform = 'mock'

  constructor(ctx: Context, config: Tester.Config) {
    super(ctx, config)
    this.app = ctx.app
    ctx.mock = this
    ctx.bots.adapters.mock = this

    if (config.database) {
      ctx.plugin(memory)
    }
  }

  bot(selfId = DEFAULT_SELF_ID) {
    const bot = this.bots.find(bot => bot.selfId === selfId)
    if (bot) return bot

    this.ctx.bots.create('mock', { selfId }, TestBot)
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

  receive(meta: Partial<Session>) {
    const session = new Session(this.bots[0], meta)
    this.dispatch(session)
    return session.id
  }
}

export namespace Tester {
  export interface Config {
    selfIds?: string[]
    database?: boolean
  }
  
  export const Config = Schema.object({
    selfIds: Schema.array(Schema.string()).default([DEFAULT_SELF_ID]),
    database: Schema.boolean(),
  })
}

Context.service('mock')
