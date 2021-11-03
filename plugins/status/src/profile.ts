import { Context } from 'koishi'
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

class Profile implements DataSource<Profile.Payload> {
  cached: Profile.Payload

  constructor(private ctx: Context, config: Profile.Config) {
    this.apply(ctx, config)
  }

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    const memory = await memoryRate()
    const cpu: LoadRate = [appRate, usedRate]
    return { memory, cpu }
  }

  private apply(ctx: Context, config: Profile.Config = {}) {
    const { tickInterval } = config

    ctx.on('connect', async () => {
      ctx.setInterval(async () => {
        updateCpuUsage()
        this.ctx.webui.broadcast('data', {
          key: 'profile',
          value: await this.get(true),
        })
      }, tickInterval)
    })
  }
}

namespace Profile {
  export interface Config {
    tickInterval?: number
  }

  export interface Payload {
    memory: LoadRate
    cpu: LoadRate
  }
}

export default Profile
