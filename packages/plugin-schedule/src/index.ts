import { Context, Session } from 'koishi-core'
import { Time, Logger } from 'koishi-utils'
import { Schedule } from './database'

export * from './database'

const logger = new Logger('schedule')

async function prepareSchedule({ id, session, interval, command, time, lastCall }: Schedule) {
  const now = Date.now()
  const date = time.valueOf()
  const { database } = session.$app

  async function executeSchedule() {
    logger.debug('execute %d: %c', id, command)
    await session.execute(command)
    if (!lastCall || !interval) return
    lastCall = new Date()
    await database.updateSchedule(id, { lastCall })
  }

  if (!interval) {
    if (date < now) {
      database.removeSchedule(id)
      if (lastCall) executeSchedule()
      return
    }

    logger.debug('prepare %d: %c at %s', id, command, time)
    return setTimeout(async () => {
      if (!await database.getSchedule(id)) return
      database.removeSchedule(id)
      executeSchedule()
    }, date - now)
  }

  logger.debug('prepare %d: %c from %s every %s', id, command, time, Time.formatTimeShort(interval))
  const timeout = date < now ? interval - (now - date) % interval : date - now
  if (lastCall && timeout + now - interval > +lastCall) {
    executeSchedule()
  }

  setTimeout(async () => {
    if (!await database.getSchedule(id)) return
    const timer = setInterval(async () => {
      if (!await database.getSchedule(id)) return clearInterval(timer)
      executeSchedule()
    }, interval)
    executeSchedule()
  }, timeout)
}

function formatContext(session: Session) {
  return session.subType === 'private' ? `私聊 ${session.userId}` : `群聊 ${session.groupId}`
}

export interface Config {
  minInterval?: number
}

export const name = 'schedule'

export function apply(ctx: Context, config: Config = {}) {
  const { database } = ctx
  const { minInterval = Time.minute } = config

  ctx.on('connect', async () => {
    const schedules = await database.getAllSchedules()
    schedules.forEach((schedule) => {
      const { session, assignee } = schedule
      if (!ctx.app.bots[assignee]) return
      schedule.session = new Session(ctx.app, session)
      prepareSchedule(schedule)
    })
  })

  ctx.command('schedule [time]', '设置定时命令', { authority: 3, checkUnknown: true })
    .option('rest', '-- <command...>  要执行的指令')
    .option('interval', '/ <interval>  设置触发的间隔秒数', { authority: 4, type: 'string' })
    .option('list', '-l  查看已经设置的日程')
    .option('ensure', '-e  错过时间也确保执行')
    .option('full', '-f  查找全部上下文', { authority: 4 })
    .option('delete', '-d <id>  删除已经设置的日程')
    .action(async ({ session, options }, ...dateSegments) => {
      if (options.delete) {
        await database.removeSchedule(options.delete)
        return `日程 ${options.delete} 已删除。`
      }

      if (options.list) {
        let schedules = await database.getAllSchedules(session.sid)
        if (!options.full) {
          schedules = schedules.filter(s => session.channelId === s.session.channelId)
        }
        if (!schedules.length) return '当前没有等待执行的日程。'
        return schedules.map(({ id, time, interval, command, session }) => {
          let output = `${id}. 触发时间：${Time.formatTimeInterval(time, interval)}，指令：${command}`
          if (options.full) output += `，上下文：${formatContext(session)}`
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
      } else if (!options.interval) {
        if (!dateString) {
          return '请输入执行时间。'
        } else if (timestamp <= Date.now()) {
          return '不能指定过去的时间为执行时间。'
        }
      }

      const interval = Time.parseTime(options.interval)
      if (!interval && options.interval) {
        return '请输入合法的时间间隔。'
      } else if (interval && interval < minInterval) {
        return '时间间隔过短。'
      }

      const schedule = await database.createSchedule(time, interval, options.rest, session, options.ensure)
      prepareSchedule(schedule)
      return `日程已创建，编号为 ${schedule.id}。`
    })
}
