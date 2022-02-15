import { Context, Dict, Logger, Schema, Session, Time } from 'koishi'

declare module 'koishi' {
  interface Tables {
    schedule: Schedule
  }

  interface Modules {
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
  session: Session.Payload
}

const logger = new Logger('schedule')

function formatContext(session: Session.Payload) {
  return session.subtype === 'private' ? `私聊 ${session.userId}` : `群聊 ${session.guildId}`
}

export const name = 'schedule'
export const using = ['database'] as const

export interface Config {
  minInterval?: number
}

export const Config: Schema<Config> = Schema.object({
  minInterval: Schema.natural().role('ms').description('允许的最小时间间隔。').default(Time.minute),
})

export function apply(ctx: Context, { minInterval }: Config) {
  ctx.model.extend('schedule', {
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

  async function hasSchedule(id: number) {
    const data = await ctx.database.get('schedule', [id])
    return data.length
  }

  async function prepareSchedule({ id, interval, command, time, lastCall }: Schedule, session: Session) {
    const now = Date.now()
    const date = time.valueOf()

    async function executeSchedule() {
      logger.debug('execute %d: %c', id, command)
      await session.execute(command)
      if (!lastCall || !interval) return
      lastCall = new Date()
      await ctx.database.set('schedule', id, { lastCall })
    }

    if (!interval) {
      if (date < now) {
        ctx.database.remove('schedule', [id])
        if (lastCall) executeSchedule()
        return
      }

      logger.debug('prepare %d: %c at %s', id, command, time)
      return ctx.setTimeout(async () => {
        if (!await hasSchedule(id)) return
        ctx.database.remove('schedule', [id])
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

  ctx.on('ready', async () => {
    const data = await ctx.database.get('schedule', {})
    const schedules: Dict<Schedule[]> = {}

    data.forEach((schedule) => {
      const { session, assignee } = schedule
      const bot = ctx.bots.get(assignee)
      if (bot) {
        prepareSchedule(schedule, new Session(bot, session))
      } else {
        (schedules[assignee] ||= []).push(schedule)
      }
    })

    ctx.on('bot-status-updated', (bot) => {
      if (bot.status !== 'online') return
      const items = schedules[bot.sid]
      if (!items) return
      delete schedules[bot.sid]
      items.forEach((schedule) => {
        prepareSchedule(schedule, new Session(bot, schedule.session))
      })
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
        await ctx.database.remove('schedule', [options.delete])
        return `日程 ${options.delete} 已删除。`
      }

      if (options.list) {
        let schedules = await ctx.database.get('schedule', { assignee: [session.sid] })
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

      const schedule = await ctx.database.create('schedule', {
        time,
        assignee: session.sid,
        interval,
        command: options.rest,
        session: session.toJSON(),
      })
      prepareSchedule(schedule, session)
      return `日程已创建，编号为 ${schedule.id}。`
    })
}
