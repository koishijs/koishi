import { Context, appMap, Database, CommandConfig, Meta } from 'koishi-core'
import ms from 'ms'
import './database'

export interface Schedule {
  id: number
  assignee: number
  time: number
  interval: number
  command: string
  meta: Meta<'message'>
}

function inspectSchedule ({ id, assignee, meta, interval, command, time }: Schedule) {
  if (!appMap[assignee]) return
  const now = Date.now()
  const app = appMap[assignee]

  if (!interval) {
    if (time < now) {
      return app.database.removeSchedule(id)
    } else {
      setTimeout(async () => {
        if (!await app.database.getSchedule(id)) return
        app.executeCommandLine(command, meta)
        app.database.removeSchedule(id)
      }, time - now)
    }
  } else {
    const timeout = time < now ? interval - (now - time) % interval : time - now
    setTimeout(async () => {
      if (!await app.database.getSchedule(id)) return
      const timer = setInterval(async () => {
        if (!await app.database.getSchedule(id)) {
          return clearInterval(timer)
        }
        app.executeCommandLine(command, meta)
      }, interval)
      app.executeCommandLine(command, meta)
    }, timeout)
  }
}

const databases = new Set<Database>()

export const name = 'schedule'

export function apply (ctx: Context, config: CommandConfig = {}) {
  const { database } = ctx.app

  ctx.app.receiver.on('connect', async () => {
    if (!database || databases.has(database) || !database.getAllSchedules) return
    databases.add(database)
    const schedules = await database.getAllSchedules()
    schedules.forEach(schedule => inspectSchedule(schedule))
  })

  ctx.command('schedule [time] -- <command>', '设置定时命令', { authority: 3, ...config })
    .option('-i, --interval <interval>', '设置触发的间隔秒数', { default: 0, authority: 4 })
    .option('-l, --list', '查看已经设置的日程')
    .option('-d, --delete <id>', '删除已经设置的日程', { notUsage: true })
    .action(async ({ meta, options, rest }, date) => {
      if (options.delete) {
        await database.removeSchedule(options.delete)
        return meta.$send('日程已删除。')
      }

      if (options.list) {
        const schedules = await database.getAllSchedules([ctx.app.selfId])
        if (!schedules.length) return meta.$send('当前没有等待执行的日程。')
        return meta.$send(schedules.map(({ id, time, interval, command }) => {
          let output = `${id}. 起始时间：${new Date(time).toLocaleString()}，`
          if (interval) output += `间隔时间：${ms(interval)}，`
          return output + `指令：${command}`
        }).join('\n'))
      }

      if (/^\d{1,2}(:\d{1,2}){1,2}$/.exec(date)) {
        date = `${new Date().toLocaleDateString()} ${date}`
      }
      const time = date ? new Date(date).valueOf() : Date.now()
      if (Number.isNaN(time)) return meta.$send('请输入合法的日期。')
      const schedule = await database.createSchedule(time, ctx.app.selfId, options.interval * 1000, rest, meta)
      await meta.$send(`日程已创建，编号为 ${schedule.id}。`)
      return inspectSchedule(schedule)
    })
}
