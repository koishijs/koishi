import { Context, Session, Time, Logger, Tables, Schema } from 'koishi'

declare module 'koishi' {
  interface Tables {
    schedule: Schedule
  }

  interface Module {
    schedule: typeof import('.')
  }
}

export interface Schedule {
  id: number
  assignee: string
  time: Date
  lastCall: Date
  interval: number
  command: string
  session: Partial<Session>
}

Tables.extend('schedule', {
  id: 'unsigned',
  assignee: 'string',
  time: 'timestamp',
  lastCall: 'timestamp',
  interval: 'integer',
  command: 'text',
  session: 'json',
}, {
  autoInc: true,
})

const logger = new Logger('schedule')

function formatContext(session: Partial<Session>) {
  return session.subtype === 'private' ? `私聊 ${session.userId}` : `群聊 ${session.guildId}`
}

export interface Config {
  minInterval?: number
}

export const name = 'schedule'

export const schema = Schema.object({
  minInterval: Schema.number('允许的最小时间间隔。').default(Time.minute),
})

export function apply(ctx: Context, config: Config = {}) {
  const { database } = ctx
  const { minInterval } = Schema.validate(config, schema)

  async function hasSchedule(id: number) {
    const data = await database.get('schedule', [id])
    return data.length
  }

  async function prepareSchedule({ id, session, interval, command, time, lastCall }: Schedule) {
    const now = Date.now()
    const date = time.valueOf()

    async function executeSchedule() {
      logger.debug('execute %d: %c', id, command)
      await session.execute(command)
      if (!lastCall || !interval) return
      lastCall = new Date()
      await database.set('schedule', id, { lastCall })
    }

    if (!interval) {
      if (date < now) {
        database.remove('schedule', [id])
        if (lastCall) executeSchedule()
        return
      }

      logger.debug('prepare %d: %c at %s', id, command, time)
      return ctx.setTimeout(async () => {
        if (!await hasSchedule(id)) return
        database.remove('schedule', [id])
        executeSchedule()
      }, date - now)
    }

    logger.debug('prepare %d: %c from %s every %s', id, command, time, Time.formatTimeShort(interval))
    const timeout = date < now ? interval - (now - date) % interval : date - now
    if (lastCall && timeout + now - interval > +lastCall) {
      executeSchedule()
    }

    ctx.setTimeout(async () => {
      if (!await hasSchedule(id)) return
      const dispose = ctx.setInterval(async () => {
        if (!await hasSchedule(id)) return dispose()
        executeSchedule()
      }, interval)
      executeSchedule()
    }, timeout)
  }

  ctx.on('connect', async () => {
    const schedules = await database.get('schedule', { assignee: ctx.bots.map(bot => bot.sid) })
    schedules.forEach((schedule) => {
      const { session, assignee } = schedule
      const bot = ctx.bots.get(assignee)
      if (!bot) return
      schedule.session = new Session(bot, session)
      prepareSchedule(schedule)
    })
  })

  ctx.command('schedule [time]', '设置定时命令', { authority: 3, checkUnknown: true })
    .option('rest', '-- <command:text>  要执行的指令')
    .option('interval', '/ <interval:string>  设置触发的间隔秒数', { authority: 4 })
    .option('list', '-l  查看已经设置的日程')
    .option('ensure', '-e  错过时间也确保执行')
    .option('full', '-f  查找全部上下文', { authority: 4 })
    .option('delete', '-d <id>  删除已经设置的日程')
    .action(async ({ session, options }, ...dateSegments) => {
      if (options.delete) {
        await database.remove('schedule', [options.delete])
        return `日程 ${options.delete} 已删除。`
      }

      if (options.list) {
        let schedules = await database.get('schedule', { assignee: [session.sid] })
        if (!options.full) {
          schedules = schedules.filter(s => session.channelId === s.session.channelId)
        }
        if (!schedules.length) return '当前没有等待执行的日程。'
        return schedules.map(({ id, time, interval, command, session }) => {
          let output = `${id}. ${Time.formatTimeInterval(time, interval)}：${command}`
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

      const schedule = await database.create('schedule', {
        time,
        assignee: session.sid,
        interval,
        command: options.rest,
        session: session.toJSON(),
      })
      schedule.session = session
      prepareSchedule(schedule)
      return `日程已创建，编号为 ${schedule.id}。`
    })
}
