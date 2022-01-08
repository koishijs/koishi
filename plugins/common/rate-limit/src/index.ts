import { Argv, Command, Context, Dict, Session, template, Time, User } from 'koishi'

declare module 'koishi' {
  namespace Command {
    interface Config {
      /** usage identifier */
      usageName?: string
      /** max usage per day */
      maxUsage?: Computed<number>
      /** min interval */
      minInterval?: Computed<number>
    }
  }

  interface User {
    usage: Dict<number>
    timers: Dict<number>
  }
}

template.set('internal', {
  'usage-exhausted': '调用次数已达上限。',
  'too-frequent': '调用过于频繁，请稍后再试。',
  'option-not-usage': '（不计入总次数）',
  'command-max-usage': '已调用次数：{0}/{1}。',
  'command-min-interval': '距离下次调用还需：{0}/{1} 秒。',
})

export const name = 'rate-limit'
export const using = ['database'] as const

export function apply(ctx: Context) {
  ctx.model.extend('user', {
    usage: 'json',
    timers: 'json',
  })

  // add user fields
  ctx.before('command/attach-user', ({ command, options = {} }, fields) => {
    if (!command) return
    const { maxUsage, minInterval } = command.config
    let shouldFetchUsage = !!(maxUsage || minInterval)
    for (const { name, notUsage } of Object.values(command._options)) {
      if (name in options && notUsage) shouldFetchUsage = false
    }
    if (shouldFetchUsage) {
      if (maxUsage) fields.add('usage')
      if (minInterval) fields.add('timers')
    }
  })

  // check user
  ctx.on('command/check', (argv: Argv<'usage' | 'timers'>) => {
    const { session, options, command } = argv
    if (!session.user) return

    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? template(message, param) : ''
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
        return sendHint('internal.usage-exhausted')
      }

      if (minInterval > 0 && checkTimer(name, session.user, minInterval)) {
        return sendHint('internal.too-frequent')
      }
    }
  })

  // extend command help
  ctx.on('help/command', (output, command, session: Session<'usage' | 'timers'>) => {
    if (!session.user) return

    const name = getUsageName(command)
    const maxUsage = command.getConfig('maxUsage', session) ?? Infinity
    const minInterval = command.getConfig('minInterval', session) ?? 0

    if (maxUsage < Infinity) {
      const count = getUsage(name, session.user)
      output.push(template('internal.command-max-usage', Math.min(count, maxUsage), maxUsage))
    }

    if (minInterval > 0) {
      const due = session.user.timers[name]
      const nextUsage = due ? (Math.max(0, due - Date.now()) / 1000).toFixed() : 0
      output.push(template('internal.command-min-interval', nextUsage, minInterval / 1000))
    }
  })

  // extend command option
  ctx.on('help/option', (output, option, command, session) => {
    const maxUsage = command.getConfig('maxUsage', session)
    if (option.notUsage && maxUsage !== Infinity) {
      output += template('internal.option-not-usage')
    }
    return output
  })
}

export function getUsageName(command: Command) {
  return command.config.usageName || command.name
}

export function getUsage(name: string, user: Pick<User, 'usage'>) {
  const $date = Time.getDateNumber()
  if (user.usage.$date !== $date) {
    user.usage = { $date }
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
  if (!(now <= timers.$date)) {
    for (const key in timers) {
      if (now > timers[key]) delete timers[key]
    }
    timers.$date = now + Time.day
  }
  if (now <= timers[name]) return true
  if (offset !== undefined) {
    timers[name] = now + offset
  }
}
