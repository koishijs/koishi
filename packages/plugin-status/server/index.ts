import { Context, App, Argv, Bot, Platform } from 'koishi-core'
import { cpus, totalmem, freemem } from 'os'
import { interpolate, Time } from 'koishi-utils'
import { ActiveData } from './database'

export * from './database'

declare module 'koishi-core' {
  interface Bot {
    counter: number[]
  }

  interface App {
    startTime: number
    getStatus(): Promise<BaseStatus>
  }
}

App.prototype.getStatus = async function (this: App) {
  const bots = await Promise.all(this.bots.map(async (bot): Promise<BotStatus> => ({
    platform: bot.platform,
    selfId: bot.selfId,
    username: bot.username,
    code: await bot.getStatus(),
    rate: bot.counter.slice(1).reduce((prev, curr) => prev + curr, 0),
  })))
  const memory = memoryRate()
  const cpu: Rate = [appRate, usedRate]
  return { bots, memory, cpu, startTime: this.startTime }
}

export interface Config {
  path?: string
  refresh?: number
  format?: string
  formatBot?: string
}

let usage = getCpuUsage()
let appRate: number
let usedRate: number

function memoryRate(): Rate {
  const totalMemory = totalmem()
  return [process.memoryUsage().rss / totalMemory, 1 - freemem() / totalMemory]
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
    app: usage / 1000,
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

export type Rate = [app: number, total: number]

export interface BaseStatus {
  bots: BotStatus[]
  memory: Rate
  cpu: Rate
  startTime: number
}

export interface Status extends BaseStatus, ActiveData {
  timestamp: number
}

export interface BotStatus {
  username?: string
  selfId: string
  platform: Platform
  code: Bot.Status
  rate?: number
}

type StatusCallback = (this: App, status: Status, config: Config) => void | Promise<void>
const callbacks: StatusCallback[] = []

export function extend(callback: StatusCallback) {
  callbacks.push(callback)
}

extend(async function (status) {
  if (!this.database) return
  Object.assign(status, this.database.getActiveData())
})

const defaultConfig: Config = {
  path: '/status',
  refresh: Time.minute,
  // eslint-disable-next-line no-template-curly-in-string
  formatBot: '{{ username }}：{{ code ? `无法连接` : `工作中（${rate}/min）` }}',
  format: [
    '{{ bots }}',
    '==========',
    '活跃用户数量：{{ activeUsers }}',
    '活跃群数量：{{ activeGroups }}',
    '启动时间：{{ new Date(startTime).toLocaleString("zh-CN", { hour12: false }) }}',
    'CPU 使用率：{{ (cpu.app * 100).toFixed() }}% / {{ (cpu.total * 100).toFixed() }}%',
    '内存使用率：{{ (memory.app * 100).toFixed() }}% / {{ (memory.total * 100).toFixed() }}%',
  ].join('\n'),
}

export const name = 'status'

export function apply(ctx: Context, config: Config = {}) {
  const all = ctx.all()
  const { refresh, formatBot, format } = { ...defaultConfig, ...config }

  all.on('command', ({ session }: Argv<'lastCall'>) => {
    session.user.lastCall = new Date()
  })

  all.before('send', (session) => {
    session.bot.counter[0] += 1
  })

  let timer: NodeJS.Timeout
  ctx.on('connect', async () => {
    ctx.app.startTime = Date.now()

    ctx.bots.forEach((bot) => {
      bot.counter = new Array(61).fill(0)
    })

    timer = setInterval(() => {
      updateCpuUsage()
      ctx.bots.forEach(({ counter }) => {
        counter.unshift(0)
        counter.splice(-1, 1)
      })
    }, 1000)

    if (!ctx.router) return
    ctx.router.get('/status', async (ctx) => {
      const status = await getStatus().catch<Status>((error) => {
        all.logger('status').warn(error)
        return null
      })
      if (!status) return ctx.status = 500
      ctx.set('Content-Type', 'application/json')
      ctx.set('Access-Control-Allow-Origin', '*')
      ctx.body = status
    })
  })

  ctx.before('disconnect', () => {
    clearInterval(timer)
  })

  ctx.command('status', '查看机器人运行状态')
    .shortcut('你的状态', { prefix: true })
    .shortcut('你的状况', { prefix: true })
    .shortcut('运行情况', { prefix: true })
    .shortcut('运行状态', { prefix: true })
    .option('all', '-a  查看全部平台')
    .action(async ({ session, options }) => {
      const status = { ...await getStatus() }
      if (!options.all) {
        status.bots = status.bots.filter(bot => bot.platform === session.platform)
      }
      status.bots.toString = () => {
        return status.bots.map(bot => {
          let output = interpolate(formatBot, bot)
          if (options.all) output = `[${bot.platform}] ` + output
          return output
        }).join('\n')
      }
      return interpolate(format, status)
    })

  async function _getStatus() {
    const status = await ctx.app.getStatus() as Status
    await Promise.all(callbacks.map(callback => callback.call(ctx.app, status, config)))
    status.timestamp = timestamp
    return status
  }

  let cachedStatus: Promise<Status>
  let timestamp: number

  async function getStatus(): Promise<Status> {
    const now = Date.now()
    if (now - timestamp < refresh) return cachedStatus
    timestamp = now
    return cachedStatus = _getStatus()
  }
}
