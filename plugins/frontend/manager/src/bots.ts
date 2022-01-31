import { Bot, Context, Dict, pick, Time } from 'koishi'
import { DataService } from '@koishijs/plugin-console'

declare module 'koishi' {
  interface Bot {
    _messageSent: TickCounter
    _messageReceived: TickCounter
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

class BotProvider extends DataService<Dict<BotProvider.Data>> {
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

    ctx.on('bot-status-updated', () => {
      this.refresh()
    })
  }

  async get() {
    return Object.fromEntries(this.ctx.bots.map((bot) => [bot.id, {
      ...pick(bot, ['platform', 'protocol', 'selfId', 'avatar', 'username', 'status', 'config']),
      error: bot.error?.message,
      adapter: bot.adapter.platform,
      messageSent: bot._messageSent.get(),
      messageReceived: bot._messageReceived.get(),
    }] as const))
  }
}

namespace BotProvider {
  export function initialize(bot: Bot, ctx: Context) {
    bot._messageSent = new TickCounter(ctx)
    bot._messageReceived = new TickCounter(ctx)
  }

  export interface Data extends Pick<Bot, 'platform' | 'protocol' | 'selfId' | 'avatar' | 'username' | 'status' | 'config'> {
    error?: string
    adapter: string
    messageSent: number
    messageReceived: number
  }
}

export default BotProvider
