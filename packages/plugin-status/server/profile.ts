import { Bot, Context, Platform } from 'koishi-core'
import { Time } from 'koishi-utils'
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
  recentRate?: MessageRate
}

export namespace BotData {
  function accumulate(record: number[]) {
    return record.slice(1).reduce((prev, curr) => prev + curr, 0)
  }

  export const from = async (bot: Bot) => ({
    platform: bot.platform,
    selfId: bot.selfId,
    username: bot.username,
    code: await bot.getStatus(),
    currentRate: [accumulate(bot.messageSent), accumulate(bot.messageReceived)],
  } as BotData)
}

export interface Profile {
  bots: BotData[]
  memory: LoadRate
  cpu: LoadRate
}

export namespace Profile {
  export interface Config {
    tick?: number
  }

  export async function from(ctx: Context) {
    const [memory, bots] = await Promise.all([
      memoryRate(),
      Promise.all(ctx.bots.map(BotData.from)),
    ])
    const cpu: LoadRate = [appRate, usedRate]
    return { bots, memory, cpu } as Profile
  }

  export function initBot(bot: Bot) {
    bot.messageSent = new Array(61).fill(0)
    bot.messageReceived = new Array(61).fill(0)
  }

  export function apply(ctx: Context, config: Config = {}) {
    const { tick = 5 * Time.second } = config

    ctx.all().before('send', (session) => {
      session.bot.messageSent[0] += 1
    })

    ctx.all().on('message', (session) => {
      session.bot.messageReceived[0] += 1
    })

    ctx.on('connect', async () => {
      ctx.bots.forEach(initBot)

      ctx.setInterval(() => {
        updateCpuUsage()
        ctx.bots.forEach(({ messageSent, messageReceived }) => {
          messageSent.unshift(0)
          messageSent.splice(-1, 1)
          messageReceived.unshift(0)
          messageReceived.splice(-1, 1)
        })
        ctx.emit('status/tick')
      }, tick)
    })
  }
}

export default Profile
