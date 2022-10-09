import { Argv, Command, Context, Dict, Schema, Session, Time, User } from 'koishi'
import { adminUser } from '@koishijs/helpers'
import {} from '@koishijs/plugin-help'
import zh from './locales/zh.yml'

declare module 'koishi' {
  namespace Command {
    interface Config {
      /** usage identifier */
      usageName?: string
      /** max usage per day */
      maxUsage?: Computed<number>
      /** min interval */
      minInterval?: Computed<number>
      bypassAuthority?: Computed<number>
    }
  }

  interface User {
    usage: Dict<number>
    timers: Dict<number>
  }

  namespace Argv {
    interface OptionConfig {
      notUsage?: boolean
    }
  }
}

export interface Config {}

export const name = 'rate-limit'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.i18n.define('zh', zh)

  ctx.model.extend('user', {
    usage: 'json',
    timers: 'json',
  })

  // add user fields
  ctx.before('command/attach-user', ({ command, options = {} }, fields) => {
    if (!command) return
    const { maxUsage, minInterval, bypassAuthority } = command.config
    let shouldFetchUsage = !!(maxUsage || minInterval)
    for (const { name, notUsage } of Object.values(command._options)) {
      // --help is not a usage (#772)
      if (name === 'help') continue
      if (name in options && notUsage) shouldFetchUsage = false
    }
    if (shouldFetchUsage) {
      if (maxUsage) fields.add('usage')
      if (minInterval) fields.add('timers')
    }
    if (bypassAuthority) fields.add('authority')
  })

  function bypassRateLimit(session: Session<'authority'>) {
    if (!session.user) return true
    const bypassAuthority = session.argv.command.getConfig('bypassAuthority', session)
    if (session.user.authority >= bypassAuthority) return true
  }

  // check user
  ctx.before('command/execute', (argv: Argv<'authority' | 'usage' | 'timers'>) => {
    const { session, options, command } = argv
    if (bypassRateLimit(session)) return

    function sendHint(path: string, ...param: any[]) {
      if (!command.config.showWarning) return ''
      return session.text([`.${path}`, `internal.${path}`], param)
    }

    let isUsage = true
    for (const { name, notUsage } of Object.values(command._options)) {
      if (name in options && notUsage) isUsage = false
    }

    // check usage
    if (isUsage) {
      const name = getUsageName(command)
      const minInterval = command.getConfig('minInterval', session)
      const maxUsage = command.getConfig('maxUsage', session)

      if (maxUsage < Infinity && checkUsage(name, session.user, maxUsage)) {
        return sendHint('usage-exhausted')
      }

      if (minInterval > 0 && checkTimer(name, session.user, minInterval)) {
        return sendHint('too-frequent')
      }
    }
  })

  // extend command help
  ctx.on('help/command', (output, command, session: Session<'authority' | 'usage' | 'timers'>) => {
    if (bypassRateLimit(session)) return

    const name = getUsageName(command)
    const maxUsage = command.getConfig('maxUsage', session) ?? Infinity
    const minInterval = command.getConfig('minInterval', session) ?? 0

    if (maxUsage < Infinity) {
      const count = getUsage(name, session.user)
      output.push(session.text('internal.command-max-usage', [Math.min(count, maxUsage), maxUsage]))
    }

    if (minInterval > 0) {
      const due = session.user.timers[name]
      const nextUsage = due ? (Math.max(0, due - Date.now()) / 1000).toFixed() : 0
      output.push(session.text('internal.command-min-interval', [nextUsage, minInterval / 1000]))
    }
  })

  // extend command option
  ctx.on('help/option', (output, option, command, session: Session<'authority'>) => {
    if (bypassRateLimit(session)) return
    const maxUsage = command.getConfig('maxUsage', session)
    if (option.notUsage && maxUsage !== Infinity) {
      output += session.text('internal.option-not-usage')
    }
    return output
  })

  ctx.command('usage [key] [value:posint]', { authority: 1 })
    .userFields(['usage'])
    .option('set', '-s', { authority: 4 })
    .option('clear', '-c', { authority: 4 })
    .use(adminUser)
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

  ctx.command('timer [key] [value:date]', { authority: 1 })
    .userFields(['timers'])
    .option('set', '-s', { authority: 4 })
    .option('clear', '-c', { authority: 4 })
    .use(adminUser)
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

export function getUsageName(command: Command) {
  return command.config.usageName || command.name
}

export function getUsage(name: string, user: Pick<User, 'usage'>) {
  const _date = Time.getDateNumber()
  if (user.usage._date !== _date) {
    user.usage = { _date }
  }
  return user.usage[name] || 0
}

export function checkUsage(name: string, user: Pick<User, 'usage'>, maxUsage?: number) {
  if (!user.usage) return
  const count = getUsage(name, user)
  if (count >= maxUsage) return true
  if (maxUsage) {
    user.usage[name] = count + 1
  }
}

export function checkTimer(name: string, { timers }: Pick<User, 'timers'>, offset?: number) {
  const now = Date.now()
  if (!(now <= timers._date)) {
    for (const key in timers) {
      if (now > timers[key]) delete timers[key]
    }
    timers._date = now + Time.day
  }
  if (now <= timers[name]) return true
  if (offset !== undefined) {
    timers[name] = now + offset
  }
}
