import { Context, Session, getContextId } from 'koishi-core'
import { parseTime, parseDate, formatTimeInterval, Logger } from 'koishi-utils'
import { Schedule } from './database'

export * from './database'

const logger = Logger.create('schedule')

function inspectSchedule ({ id, session, interval, command, time }: Schedule) {
  const now = Date.now()
  const date = time.valueOf()
  const { database } = session.$app
  logger.debug('inspect', command)

  if (!interval) {
    if (date < now) return database.removeSchedule(id)
    return setTimeout(async () => {
      if (!await database.getSchedule(id)) return
      session.$execute(command)
      database.removeSchedule(id)
    }, date - now)
  }

  const timeout = date < now ? interval - (now - date) % interval : date - now
  setTimeout(async () => {
    if (!await database.getSchedule(id)) return
    const timer = setInterval(async () => {
      if (!await database.getSchedule(id)) return clearInterval(timer)
      session.$execute(command)
    }, interval)
    session.$execute(command)
  }, timeout)
}

function formatContext (session: Session) {
  return session.messageType === 'private' ? `私聊 ${session.userId}` : `群聊 ${session.groupId}`
}

export const name = 'schedule'

export function apply (ctx: Context) {
  const { database } = ctx

  ctx.on('connect', async () => {
    const schedules = await database.getAllSchedules()
    schedules.forEach((schedule) => {
      if (!ctx.bots[schedule.assignee]) return
      schedule.session = new Session(schedule.session)
      schedule.session.$app = ctx.app
      inspectSchedule(schedule)
    })
  })

  ctx.command('schedule [time]', '设置定时命令', { authority: 3, checkUnknown: true })
    .option('--, --rest <command...>', '要执行的指令')
    .option('/, --interval <interval>', '设置触发的间隔秒数', { authority: 4, isString: true })
    .option('-l, --list', '查看已经设置的日程')
    .option('-L, --full-list', '查看全部上下文中已经设置的日程', { authority: 4 })
    .option('-d, --delete <id>', '删除已经设置的日程')
    .action(async ({ session, options }, ...dateSegments) => {
      if (options.delete) {
        await database.removeSchedule(options.delete)
        return `日程 ${options.delete} 已删除。`
      }

      if (options.list || options.fullList) {
        let schedules = await database.getAllSchedules([session.selfId])
        if (!options.fullList) {
          schedules = schedules.filter(s => getContextId(session) === getContextId(s.session))
        }
        if (!schedules.length) return '当前没有等待执行的日程。'
        return schedules.map(({ id, time, interval, command, session }) => {
          let output = `${id}. 触发时间：${formatTimeInterval(time, interval)}，指令：${command}`
          if (options.fullList) output += `，上下文：${formatContext(session)}`
          return output
        }).join('\n')
      }

      if (!options.rest) return '请输入要执行的指令。'

      const time = parseDate(dateSegments.join('-'))
      if (Number.isNaN(+time)) {
        return '请输入合法的日期。'
      } else if (!options.interval && +time <= Date.now()) {
        return '不能指定过去的时间为起始时间。'
      }

      const interval = parseTime(options.interval)
      if (!interval && options.interval) {
        return '请输入合法的时间间隔。'
      }

      const schedule = await database.createSchedule(time, interval, options.rest, session)
      await session.$send(`日程已创建，编号为 ${schedule.id}。`)
      return inspectSchedule(schedule)
    })
}
