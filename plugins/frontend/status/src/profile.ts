import { Context, Schema, Time } from 'koishi'
import { cpus, freemem, totalmem } from 'os'
import { DataService } from '@koishijs/plugin-console'

export type LoadRate = [app: number, total: number]

let usage = getCpuUsage()
let appRate: number
let usedRate: number

async function memoryRate(): Promise<LoadRate> {
  const total = totalmem()
  return [process.memoryUsage().rss / total, 1 - freemem() / total]
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

class ProfileProvider extends DataService<ProfileProvider.Payload> {
  cached: ProfileProvider.Payload

  constructor(ctx: Context, private config: ProfileProvider.Config) {
    super(ctx, 'profile')

    const { tickInterval } = config
    ctx.on('ready', () => {
      ctx.setInterval(() => {
        updateCpuUsage()
        this.refresh()
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

namespace ProfileProvider {
  export interface Config {
    tickInterval?: number
  }

  export const Config: Schema<Config> = Schema.object({
    tickInterval: Schema.natural().role('ms').description('性能数据推送的时间间隔。').default(Time.second * 5),
  })

  export interface Payload {
    memory: LoadRate
    cpu: LoadRate
  }
}

export default ProfileProvider
