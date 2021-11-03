import { Bot, Context, pick, Time } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

declare module 'koishi' {
  interface Bot {
    _messageSent: TickCounter
    _messageReceived: TickCounter
  }
}

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      bots: BotProvider
    }
  }
}

export class BotProvider extends DataSource<BotProvider.Data[]> {
  constructor(ctx: Context) {
    super(ctx, 'bots')

    ctx.any().before('send', (session) => {
      session.bot._messageSent.add(1)
    })

    ctx.any().on('message', (session) => {
      session.bot._messageReceived.add(1)
    })

    ctx.bots.forEach(bot => BotProvider.initialize(bot, ctx))
    ctx.on('bot-added', bot => BotProvider.initialize(bot, ctx))

    ctx.on('bot-removed', (bot) => {
      bot._messageSent.stop()
      bot._messageReceived.stop()
    })

    ctx.on('bot-updated', () => {
      this.broadcast()
    })
  }

  async get() {
    return this.ctx.bots.map<BotProvider.Data>((bot) => ({
      ...pick(bot, ['platform', 'selfId', 'avatar', 'username']),
      status: bot.status,
      error: bot.error?.message,
      messageSent: bot._messageSent.get(),
      messageReceived: bot._messageReceived.get(),
    }))
  }
}

class TickCounter {
  public stop: () => void

  private data = new Array(60).fill(0)

  private tick = () => {
    this.data.unshift(0)
    this.data.splice(-1, 1)
  }

  constructor(ctx: Context) {
    this.stop = ctx.setInterval(() => this.tick(), Time.second)
  }

  public add(value = 1) {
    this.data[0] += value
  }

  public get() {
    return this.data.reduce((prev, curr) => prev + curr, 0)
  }
}

export namespace BotProvider {
  export function initialize(bot: Bot, ctx: Context) {
    bot._messageSent = new TickCounter(ctx)
    bot._messageReceived = new TickCounter(ctx)
  }

  export interface Data {
    username?: string
    selfId?: string
    platform?: string
    avatar?: string
    status: Bot.Status
    error?: string
    messageSent: number
    messageReceived: number
  }
}
