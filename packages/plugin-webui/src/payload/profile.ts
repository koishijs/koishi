import { Bot, Context, Platform } from 'koishi-core'
import { cpus } from 'os'
import { mem } from 'systeminformation'

export type LoadRate = [app: number, total: number]
export type MessageRate = [send: number, receive: number]

let usage = getCpuUsage()
let appRate: number
let usedRate: number

async function memoryRate(): Promise<LoadRate> {
  const { total, active } = await mem()
  return [process.memoryUsage().rss / total, active / total]
}

function getCpuUsage() {
  let totalIdle = 0, totalTick = 0
  const cpuInfo = cpus()
  const usage = process.cpuUsage().user

  for (const cpu of cpuInfo) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type]
    }
    totalIdle += cpu.times.idle
  }

  return {
    // microsecond values
    app: usage / 1000,
    // use total value (do not know how to get the cpu on which the koishi is running)
    used: (totalTick - totalIdle) / cpuInfo.length,
    total: totalTick / cpuInfo.length,
  }
}

function updateCpuUsage() {
  const newUsage = getCpuUsage()
  const totalDifference = newUsage.total - usage.total
  appRate = (newUsage.app - usage.app) / totalDifference
  usedRate = (newUsage.used - usage.used) / totalDifference
  usage = newUsage
}

export interface BotData {
  username: string
  selfId: string
  platform: Platform
  code: Bot.Status
  currentRate: MessageRate
}

function accumulate(record: number[]) {
  return record.slice(1).reduce((prev, curr) => prev + curr, 0)
}

export async function BotData(bot: Bot) {
  return {
    platform: bot.platform,
    selfId: bot.selfId,
    username: bot.username,
    code: await bot.getStatus(),
    currentRate: [accumulate(bot.messageSent), accumulate(bot.messageReceived)],
  } as BotData
}

class Profile {
  cached: Profile.Payload

  constructor(private ctx: Context, config: Profile.Config) {
    this.apply(ctx, config)

    ctx.on('status/tick', async () => {
      this.ctx.webui.broadcast('profile', await this.get(true))
    })
  }

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    const [memory, bots] = await Promise.all([
      memoryRate(),
      Promise.all(this.ctx.bots.filter(bot => bot.platform !== 'web').map(BotData)),
    ])
    const cpu: LoadRate = [appRate, usedRate]
    return { bots, memory, cpu }
  }

  static initBot(bot: Bot) {
    bot.messageSent = new Array(61).fill(0)
    bot.messageReceived = new Array(61).fill(0)
  }

  private apply(ctx: Context, config: Profile.Config = {}) {
    const { tickInterval } = config

    ctx.all().before('send', (session) => {
      session.bot.messageSent[0] += 1
    })

    ctx.all().on('message', (session) => {
      session.bot.messageReceived[0] += 1
    })

    ctx.on('connect', async () => {
      ctx.bots.forEach(Profile.initBot)

      ctx.setInterval(() => {
        updateCpuUsage()
        ctx.bots.forEach(({ messageSent, messageReceived }) => {
          messageSent.unshift(0)
          messageSent.splice(-1, 1)
          messageReceived.unshift(0)
          messageReceived.splice(-1, 1)
        })
        ctx.emit('status/tick')
      }, tickInterval)
    })
  }
}

namespace Profile {
  export interface Config {
    tickInterval?: number
  }

  export interface Payload {
    bots: BotData[]
    memory: LoadRate
    cpu: LoadRate
  }
}

export default Profile
