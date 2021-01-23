import { Context, App, BotStatusCode, PlatformType } from 'koishi-core'
import { cpus, totalmem, freemem } from 'os'
import { interpolate, Time } from 'koishi-utils'
import { ActiveData } from './database'

export * from './database'

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    label?: string
  }

  interface Bot {
    counter: number[]
  }
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

function memoryRate() {
  const totalMemory = totalmem()
  return {
    app: process.memoryUsage().rss / totalMemory,
    total: 1 - freemem() / totalMemory,
  }
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

export interface Rate {
  app: number
  total: number
}

export interface Status extends ActiveData {
  bots: BotStatus[]
  memory: Rate
  cpu: Rate
  timestamp: number
  startTime: number
}

export interface BotStatus {
  label?: string
  selfId: string
  code: BotStatusCode
  rate?: number
}

type StatusCallback = (this: App, status: Status, config: Config) => void | Promise<void>
const callbacks: [callback: StatusCallback, local: boolean][] = []

export function extend(callback: StatusCallback, local = false) {
  callbacks.push([callback, local])
}

const startTime = Date.now()

const defaultConfig: Config = {
  path: '/status',
  refresh: Time.minute,
  // eslint-disable-next-line no-template-curly-in-string
  formatBot: '{{ label || selfId }}：{{ code ? `无法连接` : `工作中（${rate}/min）` }}',
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
  const app = ctx.app
  const { refresh, formatBot, format } = { ...defaultConfig, ...config }

  app.before('command', ({ session }) => {
    session.$user['lastCall'] = new Date()
  })

  app.before('send', (session) => {
    const { counter } = app.servers[session.kind].bots[session.selfId]
    counter[0] += 1
  })

  let timer: NodeJS.Timeout
  app.on('connect', async () => {
    app.bots.forEach((bot) => {
      bot.label = bot.label || '' + bot.selfId
      bot.counter = new Array(61).fill(0)
    })

    timer = setInterval(() => {
      updateCpuUsage()
      app.bots.forEach(({ counter }) => {
        counter.unshift(0)
        counter.splice(-1, 1)
      })
    }, 1000)

    if (!app.router) return
    app.router.get('/status', async (ctx) => {
      const status = await getStatus().catch<Status>((error) => {
        app.logger('status').warn(error)
        return null
      })
      if (!status) return ctx.status = 500
      ctx.set('Content-Type', 'application/json')
      ctx.set('Access-Control-Allow-Origin', '*')
      ctx.body = status
    })
  })

  app.before('disconnect', () => {
    clearInterval(timer)
  })

  ctx.command('status', '查看机器人运行状态')
    .shortcut('你的状态', { prefix: true })
    .shortcut('你的状况', { prefix: true })
    .shortcut('运行情况', { prefix: true })
    .shortcut('运行状态', { prefix: true })
    .action(async ({ session }) => {
      const status = await getStatus(session.kind)
      status.bots.toString = () => {
        return status.bots.map(bot => interpolate(formatBot, bot)).join('\n')
      }
      return interpolate(format, status)
    })

  async function _getStatus(kind?: PlatformType) {
    const botList = kind ? app.servers[kind].bots : app.bots
    const [data, bots] = await Promise.all([
      app.database.getActiveData(),
      Promise.all(botList.map(async (bot): Promise<BotStatus> => ({
        selfId: bot.selfId,
        label: bot.label,
        code: await bot.getStatusCode(),
        rate: bot.counter.slice(1).reduce((prev, curr) => prev + curr, 0),
      }))),
    ])
    const memory = memoryRate()
    const cpu = { app: appRate, total: usedRate }
    const status: Status = { ...data, bots, memory, cpu, timestamp, startTime }
    await Promise.all(callbacks.map(([callback, local]) => {
      if (local || !kind) return callback.call(app, status, config)
    }))
    return status
  }

  let cachedStatus: Promise<Status>
  let timestamp: number

  async function getStatus(kind?: PlatformType): Promise<Status> {
    const now = Date.now()
    if (now - timestamp < refresh) return cachedStatus
    timestamp = now
    return cachedStatus = _getStatus(kind)
  }
}
