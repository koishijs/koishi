import { Context, appMap, Database, CommandConfig } from 'koishi-core'
import { Schedule } from './database'
import './database'

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
    if (!database || databases.has(database)) return
    databases.add(database)
    const schedules = await database?.getAllSchedules()
    schedules?.forEach(schedule => inspectSchedule(schedule))
  })

  ctx.command('schedule <time> -- <command>', '设置定时命令', { authority: 3, maxUsage: 5, ...config })
    .option('-i, --interval <interval>', '设置触发的间隔秒数', { default: 0, authority: 4 })
    // .option('-l, --list', '查看已经设置的日程')
    .option('-d, --delete <id>', '删除已经设置的日程', { notUsage: true })
    .action(async ({ meta, options, rest }, date) => {
      if (options.delete) {
        await database.removeSchedule(options.delete)
        return meta.$send('日程已删除。')
      }

      const time = date ? new Date(date).valueOf() : Date.now()
      const schedule = await database.createSchedule(time, ctx.app.selfId, options.interval * 1000, rest, meta)
      await meta.$send(`日程已创建，编号为 ${schedule.id}。`)
      return inspectSchedule(schedule)
    })
}
