import { Context } from 'koishi-core'
import { SpawnOptions } from 'child_process'
import { resolve } from 'path'
import { noop } from 'koishi-utils'
import plugin, { AppStatus, getStatus } from './status'
import spawn from 'cross-spawn'

export * from './status'

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

export const name = 'status'

interface StatusOptions {
  gitFolder?: string
  sort?: (a: AppStatus, b: AppStatus) => number
}

const defaultOptions: StatusOptions = {
  gitFolder: '',
  sort: () => 1,
}

export async function apply (ctx: Context, options: StatusOptions = {}) {
  options = { ...defaultOptions, ...options }

  if (!commitTimePromise) {
    commitTimePromise = spawnAsync('git log -1 --format="%ct"', {
      cwd: resolve(process.cwd(), options.gitFolder),
    }).then((stdout) => {
      if (!stdout) return
      return new Date(parseInt(stdout) * 1000).toLocaleString()
    }).catch<string>(noop)
  }

  ctx.app.plugin(plugin)

  ctx.command('status', '查看机器人运行状态')
    .shortcut('你的状态', { prefix: true })
    .shortcut('你的状况', { prefix: true })
    .shortcut('运行情况', { prefix: true })
    .shortcut('运行状态', { prefix: true })
    .action(async ({ meta }) => {
      const { apps, cpu, memory } = await getStatus()

      const output = apps.sort(options.sort).map(({ label, selfId, code, rate }) => {
        return `${label || selfId}：${code ? '无法连接' : `工作中（${rate}/min）`}`
      })

      output.push('==========')

      const commitTime = await commitTimePromise
      if (commitTime) output.push(`更新时间：${commitTime}`)

      output.push(
        `启动时间：${startTime}`,
        `CPU 使用率：${(cpu.app * 100).toFixed()}% / ${(cpu.total * 100).toFixed()}%`,
        `内存使用率：${(memory.app * 100).toFixed()}% / ${(memory.total * 100).toFixed()}%`,
      )

      return meta.$send(output.join('\n'))
    })
}
