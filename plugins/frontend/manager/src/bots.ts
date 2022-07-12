import { Bot, Context, Dict, pick, Time } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { Loader } from '@koishijs/cli'

declare module '@satorijs/core' {
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

function getConfig(bot: Bot) {
  const record = bot.ctx.state.parent.state[Loader.kRecord]
  for (const key in record) {
    if (record[key] === bot.ctx.state) {
      return bot.ctx.state.parent.state.config[key]
    }
  }
}

class BotProvider extends DataService<Dict<BotProvider.Data>> {
  callbacks: BotProvider.Extension[] = []

  constructor(ctx: Context) {
    super(ctx, 'bots', { authority: 4 })

    ctx.any().before('send', (session) => {
      session.bot._messageSent.add(1)
    })

    ctx.any().on('message', (session) => {
      session.bot._messageReceived.add(1)
    })

    ctx.bots.forEach(bot => BotProvider.initialize(bot, ctx))

    ctx.on('bot-added', (bot) => {
      BotProvider.initialize(bot, ctx)
      process.nextTick(() => this.refresh())
    })

    ctx.on('bot-removed', (bot) => {
      process.nextTick(() => this.refresh())
      bot._messageSent.stop()
      bot._messageReceived.stop()
    })

    ctx.on('bot-status-updated', () => {
      this.refresh()
    })

    this.extend((bot) => {
      const config = getConfig(bot)
      return {
        ...pick(bot, ['platform', 'selfId', 'avatar', 'username', 'status']),
        config,
        error: bot.error?.message,
        adapter: Object.getPrototypeOf(bot).platform,
        messageSent: bot._messageSent.get(),
        messageReceived: bot._messageReceived.get(),
      }
    })
  }

  extend(callback: BotProvider.Extension) {
    this.callbacks.push(callback)
  }

  async get() {
    return Object.fromEntries(this.ctx.bots.filter(getConfig).map((bot) => [
      bot.ctx.state.uid,
      Object.assign({}, ...this.callbacks.map(cb => cb(bot))),
    ]))
  }
}

namespace BotProvider {
  export function initialize(bot: Bot, ctx: Context) {
    bot._messageSent = new TickCounter(ctx)
    bot._messageReceived = new TickCounter(ctx)
  }

  export type Extension = (bot: Bot) => Partial<Data>

  export interface Data extends Pick<Bot, 'selfId' | 'avatar' | 'username' | 'status' | 'config'> {
    error?: string
    adapter: string
    messageSent: number
    messageReceived: number
  }
}

export default BotProvider
