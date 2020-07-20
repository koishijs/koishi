import { Context } from 'koishi-core'
import plugin, { getStatus, StatusOptions } from './status'

export * from './status'

const startTime = new Date().toLocaleString()

export const name = 'status'

const defaultConfig: StatusOptions = {
  sort: () => 0,
}

export async function apply (ctx: Context, config: StatusOptions = {}) {
  config = { ...defaultConfig, ...config }

  ctx.app.plugin(plugin)

  ctx.command('status', '查看机器人运行状态')
    .shortcut('你的状态', { prefix: true })
    .shortcut('你的状况', { prefix: true })
    .shortcut('运行情况', { prefix: true })
    .shortcut('运行状态', { prefix: true })
    .action(async ({ meta }) => {
      const { apps, cpu, memory } = await getStatus(config)

      const output = apps.sort(config.sort).map(({ label, selfId, code, rate }) => {
        return `${label || selfId}：${code ? '无法连接' : `工作中（${rate}/min）`}`
      })

      output.push('==========')

      output.push(
        `启动时间：${startTime}`,
        `CPU 使用率：${(cpu.app * 100).toFixed()}% / ${(cpu.total * 100).toFixed()}%`,
        `内存使用率：${(memory.app * 100).toFixed()}% / ${(memory.total * 100).toFixed()}%`,
      )

      return meta.$send(output.join('\n'))
    })
}
