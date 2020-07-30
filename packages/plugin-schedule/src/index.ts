import { Context, Meta, getContextId } from 'koishi-core'
import { parseTime, parseDate, formatTimeInterval, Logger } from 'koishi-utils'
import { Schedule } from './database'

export * from './database'

const logger = Logger.create('schedule')

function inspectSchedule ({ id, meta, interval, command, time }: Schedule) {
  const now = Date.now()
  const date = time.valueOf()
  const { database } = meta.$app
  logger.debug('inspect', command)

  if (!interval) {
    if (date < now) return database.removeSchedule(id)
    return setTimeout(async () => {
      if (!await database.getSchedule(id)) return
      meta.$app.execute(command, meta)
      database.removeSchedule(id)
    }, date - now)
  }

  const timeout = date < now ? interval - (now - date) % interval : date - now
  setTimeout(async () => {
    if (!await database.getSchedule(id)) return
    const timer = setInterval(async () => {
      if (!await database.getSchedule(id)) return clearInterval(timer)
      meta.$app.execute(command, meta)
    }, interval)
    meta.$app.execute(command, meta)
  }, timeout)
}

function formatContext (meta: Meta) {
  return meta.messageType === 'private' ? `私聊 ${meta.userId}`
    : meta.messageType === 'group' ? `群聊 ${meta.groupId}`
    : `讨论组 ${meta.discussId}`
}

export const name = 'schedule'

export function apply (ctx: Context) {
  const { database } = ctx

  ctx.on('connect', async () => {
    const schedules = await database.getAllSchedules()
    schedules.forEach((schedule) => {
      if (!ctx.app.bots[schedule.assignee]) return
      schedule.meta = new Meta(schedule.meta)
      schedule.meta.$app = ctx.app
      inspectSchedule(schedule)
    })
  })

  ctx.command('schedule [time]', '设置定时命令', { authority: 3, checkUnknown: true })
    .option('--, --rest <command...>', '要执行的指令')
    .option('/, --interval <interval>', '设置触发的间隔秒数', { authority: 4, isString: true })
    .option('-l, --list', '查看已经设置的日程')
    .option('-L, --full-list', '查看全部上下文中已经设置的日程', { authority: 4 })
    .option('-d, --delete <id>', '删除已经设置的日程')
    .action(async ({ meta, options }, ...dateSegments) => {
      if (options.delete) {
        await database.removeSchedule(options.delete)
        return meta.$send(`日程 ${options.delete} 已删除。`)
      }

      if (options.list || options.fullList) {
        let schedules = await database.getAllSchedules([meta.selfId])
        if (!options.fullList) {
          schedules = schedules.filter(s => getContextId(meta) === getContextId(s.meta))
        }
        if (!schedules.length) return meta.$send('当前没有等待执行的日程。')
        return meta.$send(schedules.map(({ id, time, interval, command, meta }) => {
          let output = `${id}. 触发时间：${formatTimeInterval(time, interval)}，指令：${command}`
          if (options.fullList) output += `，上下文：${formatContext(meta)}`
          return output
        }).join('\n'))
      }

      if (!options.rest) return meta.$send('请输入要执行的指令。')

      const time = parseDate(dateSegments.join('-'))
      if (Number.isNaN(+time)) {
        return meta.$send('请输入合法的日期。')
      } else if (!options.interval && +time <= Date.now()) {
        return meta.$send('不能指定过去的时间为起始时间。')
      }

      const interval = parseTime(options.interval)
      if (!interval && options.interval) {
        return meta.$send('请输入合法的时间间隔。')
      }

      const schedule = await database.createSchedule(time, interval, options.rest, meta)
      await meta.$send(`日程已创建，编号为 ${schedule.id}。`)
      return inspectSchedule(schedule)
    })
}
