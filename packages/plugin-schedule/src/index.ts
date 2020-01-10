import { Context, onStart, appMap } from 'koishi-core'
import { Schedule } from './database'

function inspectSchedule ({ id, assignee, meta, interval, command, time }: Schedule, now = Date.now()) {
  if (!appMap[assignee]) return
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

export function apply (ctx: Context) {
  onStart(async ({ database }) => {
    const now = Date.now()
    const schedules = await database.getAllSchedules()
    schedules.forEach(schedule => inspectSchedule(schedule, now))
  })

  ctx.command('advanced')
    .subcommand('schedule <time> -- <command>', '设置定时命令', { authority: 3, maxUsage: 5 })
    .option('-i, --interval <interval>', '设置触发的间隔秒数', { default: 0, authority: 4 })
    // .option('-l, --list', '查看已经设置的日程')
    .option('-d, --delete <id>', '删除已经设置的日程', { notUsage: true })
    .action(async ({ meta, options, rest }, date) => {
      if (options.delete) {
        await ctx.app.database.removeSchedule(options.delete)
        return meta.$send('日程已删除。')
      }

      const time = date ? new Date(date).valueOf() : Date.now()
      const schedule = await ctx.app.database.createSchedule(time, ctx.app.options.selfId, options.interval * 1000, rest, meta)
      inspectSchedule(schedule)
      return meta.$send(`日程已创建，编号为 ${schedule.id}。`)
    })
}
