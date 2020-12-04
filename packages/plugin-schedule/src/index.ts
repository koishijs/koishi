import { Context, Session } from 'koishi-core'
import { Time, Logger } from 'koishi-utils'
import { Schedule } from './database'

export * from './database'

const logger = new Logger('schedule')

function prepareSchedule({ id, session, interval, command, time }: Schedule) {
  const now = Date.now()
  const date = time.valueOf()
  const { database } = session.$app
  logger.debug('prepare %d: %c at %s', id, command, time)

  function executeSchedule() {
    logger.debug('execute %d: %c', id, command)
    return session.$execute(command)
  }

  if (!interval) {
    if (date < now) return database.removeSchedule(id)
    return setTimeout(async () => {
      if (!await database.getSchedule(id)) return
      await database.removeSchedule(id)
      await executeSchedule()
    }, date - now)
  }

  const timeout = date < now ? interval - (now - date) % interval : date - now
  setTimeout(async () => {
    if (!await database.getSchedule(id)) return
    const timer = setInterval(async () => {
      if (!await database.getSchedule(id)) return clearInterval(timer)
      await executeSchedule()
    }, interval)
    await executeSchedule()
  }, timeout)
}

function formatContext(session: Session) {
  return session.subType === 'private' ? `私聊 ${session.userId}` : `群聊 ${session.groupId}`
}

export const name = 'schedule'

export function apply(ctx: Context) {
  const { database } = ctx

  ctx.on('connect', async () => {
    const schedules = await database.getAllSchedules()
    schedules.forEach((schedule) => {
      if (!ctx.bots[schedule.assignee]) return
      schedule.session = new Session(ctx.app, schedule.session)
      prepareSchedule(schedule)
    })
  })

  ctx.command('schedule [time]', '设置定时命令', { authority: 3, checkUnknown: true })
    .option('rest', '-- <command...>  要执行的指令')
    .option('interval', '/ <interval>  设置触发的间隔秒数', { authority: 4, type: 'string' })
    .option('list', '-l  查看已经设置的日程')
    .option('fullList', '-L  查看全部上下文中已经设置的日程', { authority: 4 })
    .option('delete', '-d <id>  删除已经设置的日程')
    .action(async ({ session, options }, ...dateSegments) => {
      if (options.delete) {
        await database.removeSchedule(options.delete)
        return `日程 ${options.delete} 已删除。`
      }

      if (options.list || options.fullList) {
        let schedules = await database.getAllSchedules([session.selfId])
        if (!options.fullList) {
          schedules = schedules.filter(s => session.channelId === s.session.channelId)
        }
        if (!schedules.length) return '当前没有等待执行的日程。'
        return schedules.map(({ id, time, interval, command, session }) => {
          let output = `${id}. 触发时间：${Time.formatTimeInterval(time, interval)}，指令：${command}`
          if (options.fullList) output += `，上下文：${formatContext(session)}`
          return output
        }).join('\n')
      }

      if (!options.rest) return '请输入要执行的指令。'

      const dateString = dateSegments.join('-')
      const time = Time.parseDate(dateString)
      const timestamp = +time
      if (Number.isNaN(timestamp) || timestamp > 2147483647000) {
        if (/^\d+$/.test(dateString)) {
          return `请输入合法的日期。你要输入的是不是 ${dateString}s？`
        } else {
          return '请输入合法的日期。'
        }
      } else if (!options.interval && timestamp <= Date.now()) {
        return '不能指定过去的时间为起始时间。'
      }

      const interval = Time.parseTime(options.interval)
      if (!interval && options.interval) {
        return '请输入合法的时间间隔。'
      }

      const schedule = await database.createSchedule(time, interval, options.rest, session)
      prepareSchedule(schedule)
      return `日程已创建，编号为 ${schedule.id}。`
    })
}
