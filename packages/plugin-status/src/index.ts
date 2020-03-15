import { App, appList, Context, onStart, onStop } from 'koishi-core'
import { cpus, totalmem, freemem } from 'os'
import { SpawnOptions } from 'child_process'
import { resolve } from 'path'
import { noop } from 'koishi-utils'
import spawn from 'cross-spawn'

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    label?: string
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

let usage = getCpuUsage()
let appRate: number
let usedRate: number
let timer: NodeJS.Timeout

onStart(() => {
  timer = setInterval(function() {
    let newUsage = getCpuUsage()
    const totalDifference = newUsage.total - usage.total
    appRate = (newUsage.app - usage.app) / totalDifference
    usedRate = (newUsage.used - usage.used) / totalDifference
  }, 1000)
})

onStop(() => {
  clearInterval(timer)
})

function memoryRate () {
  const totalMemory = totalmem()
  return {
    app: process.memoryUsage().rss / totalMemory,
    total: 1 - freemem() / totalMemory,
  }
}

function spawnAsync (command: string, options: SpawnOptions) {
  return new Promise<string>((resolve) => {
    let stdout = ''
    const child = spawn(command, options)
    child.stdout.on('data', chunk => stdout += chunk)
    child.on('close', () => resolve(stdout))
  })
}

const startTime = new Date().toLocaleString()

let commitTimePromise: Promise<string>

const sendEventCounter = new WeakMap<App, number[]>()

export const name = 'status'

interface StatusOptions {
  gitFolder?: string
  refreshInterval?: number
  sort?: (a: App, b: App) => number
}

const defaultOptions: StatusOptions = {
  gitFolder: '',
  refreshInterval: 1000,
  sort: () => 1,
}

export async function apply (ctx: Context, options: StatusOptions = {}) {
  const { app } = ctx
  options = { ...defaultOptions, ...options }

  if (!commitTimePromise) {
    commitTimePromise = spawnAsync('git log -1 --format="%ct"', {
      cwd: resolve(process.cwd(), options.gitFolder),
    }).then((stdout) => {
      if (!stdout) return
      return new Date(parseInt(stdout) * 1000).toLocaleString()
    }).catch<string>(noop)
  }

  if (!sendEventCounter.has(app)) {
    sendEventCounter.set(app, new Array(61).fill(0))

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
      }, options.refreshInterval)
    })

    app.on('before-disconnect', () => {
      clearInterval(timer)
    })
  }

  ctx.command('status', '查看机器人运行状态')
    .shortcut('你的状态', { prefix: true })
    .shortcut('你的状况', { prefix: true })
    .shortcut('运行情况', { prefix: true })
    .shortcut('运行状态', { prefix: true })
    .action(async ({ meta }) => {
      const data = await Promise.all(appList.sort(options.sort).map(async (app) => ({
        app,
        good: await app.sender.getStatus().then(status => status.good, () => false),
      })))

      let goodCount = 0
      const output = data.map(({ good, app }) => {
        const { label, selfId } = app.options
        let output = (label || selfId) + '：'
        if (good) {
          goodCount += 1
          output += '工作中'
          const messages = sendEventCounter.get(app)
          if (messages) {
            output += `（${messages.slice(1).reduce((prev, curr) => prev + curr, 0)}/min）`
          }
        } else {
          output += '无法连接'
        }
        return output
      })

      const userCount = await ctx.database.getUserCount()
      const groupCount = await ctx.database.getGroupCount()
      output.unshift(`${goodCount} 名四季酱正在为 ${groupCount} 个群和 ${userCount} 名用户提供服务。`)

      const memory = memoryRate()
      output.push('==========')

      const commitTime = await commitTimePromise
      if (commitTime) output.push(`更新时间：${commitTime}`)

      output.push(
        `启动时间：${startTime}`,
        `已载入指令：${app._commands.length}`,
        `已载入中间件：${app._middlewares.length}`,
        `CPU 使用率：${(appRate * 100).toFixed()}% / ${(usedRate * 100).toFixed()}%`,
        `内存使用率：${(memory.app * 100).toFixed()}% / ${(memory.total * 100).toFixed()}%`,
      )

      return meta.$send(output.join('\n'))
    })
}
