import { Context, Schema, Time } from 'koishi'
import { cpus } from 'os'
import { mem } from 'systeminformation'
import { DataSource } from '@koishijs/plugin-console'

export type LoadRate = [app: number, total: number]

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
    used: totalTick - totalIdle,
    total: totalTick,
  }
}

function updateCpuUsage() {
  const newUsage = getCpuUsage()
  const totalDifference = newUsage.total - usage.total
  appRate = (newUsage.app - usage.app) / totalDifference
  usedRate = (newUsage.used - usage.used) / totalDifference
  usage = newUsage
}

export class ProfileProvider extends DataSource<ProfileProvider.Payload> {
  cached: ProfileProvider.Payload

  constructor(ctx: Context, private config: ProfileProvider.Config) {
    super(ctx, 'profile')

    const { tickInterval } = config
    ctx.on('connect', () => {
      ctx.setInterval(() => {
        updateCpuUsage()
        this.broadcast()
      }, tickInterval)
    })
  }

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    const memory = await memoryRate()
    const cpu: LoadRate = [appRate, usedRate]
    return { memory, cpu }
  }
}

export namespace ProfileProvider {
  export interface Config {
    tickInterval?: number
  }

  export const Config = Schema.object({
    tickInterval: Schema.number().description('性能数据推送的时间间隔。').default(Time.second * 5),
  })

  export interface Payload {
    memory: LoadRate
    cpu: LoadRate
  }
}
