import { appList, onStart, onStop, onApp, App } from 'koishi-core'
import { cpus, totalmem, freemem } from 'os'
import { Server, createServer } from 'http'
import { cyan } from 'kleur'

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    label?: string
    statusPort?: number
  }
}

let usage = getCpuUsage()
let appRate: number
let usedRate: number
let timer: NodeJS.Timeout
let server: Server
let statusPort: number

const sendEventCounter = new WeakMap<App, number[]>()

onApp((app) => {
  sendEventCounter.set(app, new Array(61).fill(0))

  if (app.options.statusPort) {
    statusPort = app.options.statusPort
  }

  app.on('after-command', (argv) => {
    argv.meta.$user.lastCall = new Date()
  })

  app.on('before-send', () => {
    const messages = sendEventCounter.get(app)
    messages[0] += 1
  })

  let timer: NodeJS.Timeout
  app.on('before-connect', () => {
    timer = setInterval(() => {
      const messages = sendEventCounter.get(app)
      messages.unshift(0)
      messages.splice(-1, 1)
    }, 1000)
  })

  app.on('before-disconnect', () => {
    clearInterval(timer)
  })
})

onStart(() => {
  timer = setInterval(function() {
    let newUsage = getCpuUsage()
    const totalDifference = newUsage.total - usage.total
    appRate = (newUsage.app - usage.app) / totalDifference
    usedRate = (newUsage.used - usage.used) / totalDifference
  }, 1000)

  if (!statusPort) return
  server = createServer(async (req, res) => {
    const status = await getStatus().catch((error) => {
      appList[0].logger('status').warn(error)
      return null as Status
    })
    if (!status) return res.writeHead(500).end()
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    res.write(JSON.stringify(status))
    res.end()
  }).listen(statusPort)
  appList[0].logger('status').info(`server listening at ${cyan(statusPort)}`)
})

onStop(() => {
  clearInterval(timer)
  if (server) server.close()
})

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
  label: string
  selfId: number
  good: boolean
  rate?: number
}

let cachedStatus: Status
let timestamp: number

type StatusGetter = () => Partial<Status> | Promise<Partial<Status>>
const statusGetters: StatusGetter[] = []

export function extendStatus (callback: StatusGetter) {
  statusGetters.push(callback)
}

export async function getStatus (): Promise<Status> {
  const now = Date.now()
  if (now - timestamp < 60000) return cachedStatus
  const [userCount, groupCount, apps, data] = await Promise.all([
    appList[0].database.getActiveUserCount(),
    appList[0].database.getActiveGroupCount(),
    Promise.all(appList.map<Promise<AppStatus>>(async (app) => ({
      label: app.options.label,
      selfId: app.options.selfId,
      good: await app.sender.getStatus().then(status => status.good, () => false),
      rate: (sendEventCounter.get(app) || []).slice(1).reduce((prev, curr) => prev + curr, 0),
    }))),
    Promise.all(statusGetters.map(getter => getter())),
  ])
  const memory = memoryRate()
  const cpu = { app: appRate, total: usedRate }
  timestamp = now
  cachedStatus = { apps, userCount, groupCount, memory, cpu, timestamp }
  data.forEach(status => Object.assign(cachedStatus, status))
  return cachedStatus
}
