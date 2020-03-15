import { Context, appMap, Meta, onStart, appList, getContextId } from 'koishi-core'
import { parseTime, parseDate, formatContext, formatTimeAndInterval } from './utils'
import './database'

export * from './utils'

export interface Schedule {
  id: number
  assignee: number
  time: Date
  interval: number
  command: string
  meta: Meta<'message'>
}

function inspectSchedule ({ id, assignee, meta, interval, command, time }: Schedule) {
  if (!appMap[assignee]) return
  const now = Date.now()
  const date = time.valueOf()
  const app = appMap[assignee]

  if (!interval) {
    if (date < now) return app.database.removeSchedule(id)
    return setTimeout(async () => {
      if (!await app.database.getSchedule(id)) return
      app.executeCommandLine(command, meta)
      app.database.removeSchedule(id)
    }, date - now)
  }

  const timeout = date < now ? interval - (now - date) % interval : date - now
  setTimeout(async () => {
    if (!await app.database.getSchedule(id)) return
    const timer = setInterval(async () => {
      if (!await app.database.getSchedule(id)) return clearInterval(timer)
      app.executeCommandLine(command, meta)
    }, interval)
    app.executeCommandLine(command, meta)
  }, timeout)
}

onStart(async () => {
  const { database } = appList[0]
  const schedules = await database.getAllSchedules()
  schedules.forEach(schedule => inspectSchedule(schedule))
})

export const name = 'schedule'

export function apply (ctx: Context) {
  const { database } = ctx.app

  ctx.command('schedule [time] -- <command>', '设置定时命令', { authority: 3, checkUnknown: true })
    .option('-i, --interval <interval>', '设置触发的间隔秒数', { authority: 4, isString: true })
    .option('-l, --list', '查看已经设置的日程')
    .option('-L, --full-list', '查看全部上下文中已经设置的日程', { authority: 4 })
    .option('-d, --delete <id>', '删除已经设置的日程')
    .action(async ({ meta, options, rest }, ...dateSegments) => {
      if (options.delete) {
        await database.removeSchedule(options.delete)
        return meta.$send('日程已删除。')
      }

      if (options.list || options.fullList) {
        let schedules = await database.getAllSchedules([ctx.app.selfId])
        if (!options.fullList) {
          schedules = schedules.filter(s => getContextId(meta) === getContextId(s.meta))
        }
        if (!schedules.length) return meta.$send('当前没有等待执行的日程。')
        return meta.$send(schedules.map(({ id, time, interval, command, meta }) => {
          let output = `${id}. 触发时间：${formatTimeAndInterval(time, interval)}，指令：${command}`
          if (options.fullList) output += `，上下文：${formatContext(meta)}`
          return output
        }).join('\n'))
      }

      if (!rest) return meta.$send('请输入要执行的指令。')

      const time = parseDate(dateSegments.join('-'))
      if (Number.isNaN(+time)) {
        return meta.$send('请输入合法的日期。')
      }

      const interval = parseTime(options.interval)
      if (!interval && options.interval) {
        return meta.$send('请输入合法的时间间隔。')
      }

      const schedule = await database.createSchedule(time, ctx.app.selfId, interval, rest, meta)
      await meta.$send(`日程已创建，编号为 ${schedule.id}。`)
      return inspectSchedule(schedule)
    })
}
