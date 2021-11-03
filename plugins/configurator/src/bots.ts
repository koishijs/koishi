import { Bot, Context, pick, Time } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

declare module 'koishi' {
  interface Bot {
    _messageSent: TickCounter
    _messageReceived: TickCounter
  }
}

declare module '@koishijs/plugin-console' {
  namespace DataSource {
    interface Library {
      bots: BotSource
    }
  }
}

export class BotSource implements DataSource<BotSource.Data[]> {
  constructor(private ctx: Context) {
    ctx.any().before('send', (session) => {
      session.bot._messageSent.add(1)
    })

    ctx.any().on('message', (session) => {
      session.bot._messageReceived.add(1)
    })

    ctx.on('bot-updated', () => {
      this.ctx.webui.broadcast('data', {
        key: 'bots',
        value: this.get(),
      })
    })

    ctx.on('connect', async () => {
      ctx.bots.forEach(BotSource.initialize)
      ctx.on('bot-added', BotSource.initialize)

      ctx.setInterval(() => {
        ctx.bots.forEach(({ _messageSent, _messageReceived }) => {
          _messageSent.tick()
          _messageReceived.tick()
        })
      }, Time.second)
    })
  }

  get() {
    return this.ctx.bots.map<BotSource.Data>((bot) => ({
      ...pick(bot, ['platform', 'selfId', 'avatar', 'username']),
      status: bot.status,
      error: bot.error?.message,
      messageSent: bot._messageSent.get(),
      messageReceived: bot._messageReceived.get(),
    }))
  }
}

class TickCounter {
  private data = new Array(60).fill(0)

  add(value = 1) {
    this.data[0] += value
  }

  tick() {
    this.data.unshift(0)
    this.data.splice(-1, 1)
  }

  get() {
    return this.data.reduce((prev, curr) => prev + curr, 0)
  }
}

export namespace BotSource {
  export function initialize(bot: Bot) {
    bot._messageSent = new TickCounter()
    bot._messageReceived = new TickCounter()
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
