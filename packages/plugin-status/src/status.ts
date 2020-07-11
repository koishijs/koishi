import { appList, App, Command } from 'koishi-core'
import { cpus, totalmem, freemem } from 'os'

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    label?: string
    statusPort?: number
  }
}

Command.userFields(['lastCall'])

let usage = getCpuUsage()
let appRate: number
let usedRate: number

const sendEventCounter = new WeakMap<App, number[]>()

function memoryRate () {
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

function updateCpuUsage () {
  const newUsage = getCpuUsage()
  const totalDifference = newUsage.total - usage.total
  appRate = (newUsage.app - usage.app) / totalDifference
  usedRate = (newUsage.used - usage.used) / totalDifference
}

export interface Rate {
  app: number
  total: number
}

export interface Status {
  apps: AppStatus[]
  userCount: number
  groupCount: number
  memory: Rate
  cpu: Rate
  timestamp: number
}

export interface AppStatus {
  label?: string
  selfId: number
  code: number
  rate?: number
}

type StatusModifier = (status: Status) => void | Promise<void>
const statusModifiers: StatusModifier[] = []

export function extendStatus (callback: StatusModifier) {
  statusModifiers.push(callback)
}

async function _getStatus () {
  const [userCount, groupCount, apps] = await Promise.all([
    appList[0].database.getActiveUserCount(),
    appList[0].database.getActiveGroupCount(),
    Promise.all(appList.map<Promise<AppStatus>>(async (app) => ({
      label: app.options.label,
      selfId: app.options.selfId,
      code: await app.sender.getStatus().then(status => status.good ? 0 : 1, () => 2),
      rate: (sendEventCounter.get(app) || []).slice(1).reduce((prev, curr) => prev + curr, 0),
    }))),
  ])
  const memory = memoryRate()
  const cpu = { app: appRate, total: usedRate }
  const status: Status = { apps, userCount, groupCount, memory, cpu, timestamp }
  for (const modifier of statusModifiers) {
    await modifier(status)
  }
  return status
}

let cachedStatus: Promise<Status>
let timestamp: number

export async function getStatus (): Promise<Status> {
  const now = Date.now()
  if (now - timestamp < 60000) return cachedStatus
  timestamp = now
  return cachedStatus = _getStatus()
}

export default function apply (app: App) {
  app.on('before-command', ({ meta }) => {
    meta.$user['lastCall'] = new Date()
  })

  app.on('before-send', () => {
    const messages = sendEventCounter.get(app)
    messages[0] += 1
  })

  let timer: NodeJS.Timeout
  app.on('connect', () => {
    sendEventCounter.set(app, new Array(61).fill(0))
    timer = setInterval(() => {
      const messages = sendEventCounter.get(app)
      messages.unshift(0)
      messages.splice(-1, 1)
      updateCpuUsage()
    }, 1000)

    app.server.koa.use(async (ctx, next) => {
      if (ctx.path !== '/status') return next()
      const status = await getStatus().catch<Status>((error) => {
        appList[0].logger('status').warn(error)
        return null
      })
      if (!status) return ctx.status = 500
      ctx.set('Content-Type', 'application/json')
      ctx.set('Access-Control-Allow-Origin', '*')
      ctx.body = status
    })
  })

  app.on('before-disconnect', () => {
    clearInterval(timer)
  })
}
