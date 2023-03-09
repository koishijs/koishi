import { Context } from 'koishi'
import {} from '@koishijs/plugin-admin'

export const name = 'usage-admin'

export function apply(ctx: Context) {
  ctx.command('usage [key] [value:posint]', { authority: 1, admin: { user: true } })
    .userFields(['usage'])
    .option('set', '-s', { authority: 4 })
    .option('clear', '-c', { authority: 4 })
    .action(({ session, options }, name, count) => {
      const { user } = session
      if (options.clear) {
        name ? delete user.usage[name] : user.usage = {}
        return
      }

      if (options.set) {
        if (!count) return session.text('internal.insufficient-arguments')
        user.usage[name] = count
        return
      }

      if (name) return session.text('.present', [name, user.usage[name] || 0])
      const output: string[] = []
      for (const name of Object.keys(user.usage).sort()) {
        if (name.startsWith('_')) continue
        output.push(`${name}：${user.usage[name]}`)
      }
      if (!output.length) return session.text('.none')
      output.unshift(session.text('.list'))
      return output.join('\n')
    })

  ctx.command('timer [key] [value:date]', { authority: 1, admin: { user: true } })
    .userFields(['timers'])
    .option('set', '-s', { authority: 4 })
    .option('clear', '-c', { authority: 4 })
    .action(({ session, options }, name, value) => {
      const { user } = session
      if (options.clear) {
        name ? delete user.timers[name] : user.timers = {}
        return
      }

      if (options.set) {
        if (!value) return session.text('internal.insufficient-arguments')
        user.timers[name] = +value
        return
      }

      const now = Date.now()
      if (name) {
        const delta = user.timers[name] - now
        if (delta > 0) return session.text('.present', [name, delta])
        return session.text('.absent', [name])
      }
      const output: string[] = []
      for (const name of Object.keys(user.timers).sort()) {
        if (name.startsWith('_')) continue
        output.push(session.text('.item', [name, user.timers[name] - now]))
      }
      if (!output.length) return session.text('.none')
      output.unshift(session.text('.list'))
      return output.join('\n')
    })
}
