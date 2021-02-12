import { isInteger, difference, observe, Time, enumKeys, Random, template } from 'koishi-utils'
import { Context, User, Channel, Command, Argv, Platform, Session } from 'koishi-core'

type AdminAction<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}, T>
  = (argv: Argv<U | 'authority', G, A, O> & { target: T }, ...args: A)
    => void | string | Promise<void | string>

declare module 'koishi-core/dist/command' {
  interface Command<U, G, A, O> {
    adminUser(callback: AdminAction<U, G, A, O, User.Observed<U | 'authority'>>): this
    adminChannel(callback: AdminAction<U, G, A, O, Channel.Observed<G>>): this
  }
}

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'common/callme'(name: string, session: Session): string | void
  }
}

/* eslint-disable quote-props */
template.set('admin', {
  // flag
  'unknown-flag': '未找到标记 {0}。',
  'all-flags': '全部标记为：{0}。',
  'no-flags': '未设置任何标记。',
  'current-flags': '当前的标记为：{0}。',

  // admin helper
  'user-not-found': '未找到指定的用户。',
  'user-unchanged': '用户数据未改动。',
  'user-updated': '用户数据已修改。',
  'channel-not-found': '未找到指定的频道。',
  'channel-unchanged': '频道数据未改动。',
  'channel-updated': '频道数据已修改。',
  'not-in-group': '当前不在群组上下文中，请使用 -t 参数指定目标频道。',
})

template.set('callme', {
  'current': '好的呢，{0}！',
  'unnamed': '你还没有给自己起一个称呼呢~',
  'unchanged': '称呼未发生变化。',
  'empty': '称呼不能为空。',
  'invalid': '称呼中禁止包含纯文本以外的内容。',
  'duplicate': '禁止与其他用户重名。',
  'updated': '好的，{0}，请多指教！',
  'failed': '修改称呼失败。',
})

template.set('bind', {
  'generated': [
    '请在 5 分钟内使用你的账号在已绑定的平台内私聊机器人发送以下文本：',
    '{0}',
    '注意：每个账号只能绑定到每个平台一次，此操作将会抹去你当前平台上的数据，请谨慎操作！',
  ].join('\n'),
  'failed': '账号绑定失败：你已经绑定过该平台。',
  'success': '账号绑定成功！',
})

interface FlagOptions {
  list?: boolean
  set?: boolean
  unset?: boolean
}

type FlagMap = Record<string, number> & Record<number, string>

interface FlagArgv extends Argv<never, never, string[], FlagOptions> {
  target: User.Observed<'flag'> | Channel.Observed<'flag'>
}

function flagAction(map: any, { target, options }: FlagArgv, ...flags: string[]): string
function flagAction(map: FlagMap, { target, options }: FlagArgv, ...flags: string[]) {
  if (options.set || options.unset) {
    const notFound = difference(flags, enumKeys(map))
    if (notFound.length) return template('admin.unknown-flag', notFound.join(', '))
    for (const name of flags) {
      options.set ? target.flag |= map[name] : target.flag &= ~map[name]
    }
    return
  }

  if (options.list) {
    return template('admin.all-flags', enumKeys(map).join(', '))
  }

  let flag = target.flag
  const keys: string[] = []
  while (flag) {
    const value = 2 ** Math.floor(Math.log2(flag))
    flag -= value
    keys.unshift(map[value])
  }
  if (!keys.length) return template('admin.no-flags')
  return template('admin.current-flags', keys.join(', '))
}

Command.prototype.adminUser = function (this: Command, callback) {
  const command = this
    .userFields(['authority'])
    .option('target', '-t [user]  指定目标用户', { authority: 3 })

  command._actions.unshift(async (argv) => {
    const { options, session, args } = argv
    const fields = session.collect('user', argv)
    let target: User.Observed<never>
    if (options.target) {
      const id = session.$bot.parseUser(options.target)
      if (!id) return '请指定正确的目标。'
      const { database } = session.$app
      const data = await database.getUser(session.platform, id, [...fields])
      if (!data) return template('admin.user-not-found')
      if (id === session.userId) {
        target = await session.observeUser(fields)
      } else if (session.$user.authority <= data.authority) {
        return template('internal.low-authority')
      } else {
        target = observe(data, diff => database.setUser(session.platform, id, diff), `user ${id}`)
      }
    } else {
      target = await session.observeUser(fields)
    }
    const diffKeys = Object.keys(target._diff)
    const result = await callback({ ...argv, target }, ...args)
    if (typeof result === 'string') return result
    if (!difference(Object.keys(target._diff), diffKeys).length) return template('admin.user-unchanged')
    await target._update()
    return template('admin.user-updated')
  })

  return command
}

Command.prototype.adminChannel = function (this: Command, callback) {
  const command = this
    .userFields(['authority'])
    .option('target', '-t [channel]  指定目标频道', { authority: 3 })

  command._actions.unshift(async (argv, ...args) => {
    const { options, session } = argv
    const fields = session.collect('channel', argv)
    let target: Channel.Observed
    if (options.target) {
      const id = session.$bot.parseChannel(options.target)
      if (!id) return '请指定正确的目标。'
      const { database } = session.$app
      const data = await session.getChannel(id, '', [...fields])
      if (!data) return template('admin.channel-not-found')
      target = observe(data, diff => database.setChannel(session.platform, id, diff), `channel ${id}`)
    } else if (session.subtype === 'group') {
      target = await session.observeChannel(fields)
    } else {
      return template('admin.not-in-group')
    }
    const result = await callback({ ...argv, target }, ...args)
    if (typeof result === 'string') return result
    if (!Object.keys(target._diff).length) return template('admin.channel-unchanged')
    await target._update()
    return template('admin.channel-updated')
  })

  return command
}

export function apply(ctx: Context) {
  ctx.command('common/user', '用户管理', { authority: 3 })
  ctx.command('common/channel', '频道管理', { authority: 3 })

  ctx.command('common/callme [name:text]', '修改自己的称呼')
    .userFields(['id', 'name'])
    .shortcut('叫我', { prefix: true, fuzzy: true, greedy: true })
    .action(async ({ session }, name) => {
      const { $user } = session
      if (!name) {
        if ($user.name) {
          return template('callme.current', session.$username)
        } else {
          return template('callme.unnamed')
        }
      } else if (name === $user.name) {
        return template('callme.unchanged')
      } else if (!(name = name.trim())) {
        return template('callme.empty')
      } else if (name.includes('[CQ:')) {
        return template('callme.invalid')
      }

      const result = ctx.bail('common/callme', name, session)
      if (result) return result

      try {
        $user.name = name
        await $user._update()
        return template('callme.updated', session.$username)
      } catch (error) {
        if (error[Symbol.for('koishi.error-type')] === 'duplicate-entry') {
          return template('callme.duplicate')
        } else {
          ctx.logger('common').warn(error)
          return template('callme.failed')
        }
      }
    })

  const ctx2 = ctx.private()
  const tokens: Record<string, [platform: Platform, id: string]> = {}

  ctx2.command('user/bind', '绑定到账号', { authority: 0 })
    .action(({ session }) => {
      const token = Random.uuid()
      const data = tokens[token] = [session.platform, session.userId]
      setTimeout(() => {
        if (tokens[token] === data) delete tokens[token]
      }, 5 * Time.minute)
      return template('bind.generated', token)
    })

  ctx2.middleware(async (session, next) => {
    const data = tokens[session.content]
    if (!data) return next()
    const user = await session.observeUser(['authority', data[0]])
    if (!user.authority) return next()
    if (user[data[0]]) return session.send(template('bind.failed'))
    user[data[0] as any] = data[1]
    await user._update()
    return session.send(template('bind.success'))
  }, true)

  ctx.command('user/authorize <value>', '权限信息', { authority: 4 })
    .alias('auth')
    .adminUser(async ({ session, target }, value) => {
      const authority = Number(value)
      if (!isInteger(authority) || authority < 0) return '参数错误。'
      if (authority >= session.$user.authority) return template('internal.low-authority')
      await ctx.database.createUser(session.platform, session.userId, { authority })
      target._merge({ authority })
    })

  ctx.command('user.flag [-s|-S] [...flags]', '标记信息', { authority: 3 })
    .userFields(['flag'])
    .option('list', '-l  标记列表')
    .option('set', '-s  添加标记', { authority: 4 })
    .option('unset', '-S  删除标记', { authority: 4 })
    .adminUser(flagAction.bind(null, User.Flag))

  ctx.command('user.usage [key]', '调用次数信息')
    .userFields(['usage'])
    .option('set', '-s  设置调用次数', { authority: 4 })
    .option('clear', '-c  清空调用次数', { authority: 4 })
    .adminUser(({ target, options }, name, value) => {
      if (options.clear) {
        name ? delete target.usage[name] : target.usage = {}
        return
      }

      if (options.set) {
        if (value === undefined) return '参数不足。'
        const count = +value
        if (!isInteger(count) || count < 0) return '参数错误。'
        target.usage[name] = count
        return
      }

      if (name) return `今日 ${name} 功能的调用次数为：${target.usage[name] || 0}`
      const output: string[] = []
      for (const name of Object.keys(target.usage).sort()) {
        if (name.startsWith('$')) continue
        output.push(`${name}：${target.usage[name]}`)
      }
      if (!output.length) return '今日没有调用过消耗次数的功能。'
      output.unshift('今日各功能的调用次数为：')
      return output.join('\n')
    })

  ctx.command('user.timer [key]', '定时器信息')
    .userFields(['timers'])
    .option('set', '-s  设置定时器', { authority: 4 })
    .option('clear', '-c  清空定时器', { authority: 4 })
    .adminUser(({ target, options }, name, value) => {
      if (options.clear) {
        name ? delete target.timers[name] : target.timers = {}
        return
      }

      if (options.set) {
        if (value === undefined) return '参数不足。'
        const timestamp = +Time.parseDate(value)
        if (!timestamp) return '请输入合法的时间。'
        target.timers[name] = timestamp
        return
      }

      const now = Date.now()
      if (name) {
        const delta = target.timers[name] - now
        if (delta > 0) return `定时器 ${name} 的生效时间为：剩余 ${Time.formatTime(delta)}`
        return `定时器 ${name} 当前并未生效。`
      }
      const output: string[] = []
      for (const name of Object.keys(target.timers).sort()) {
        if (name.startsWith('$')) continue
        output.push(`${name}：剩余 ${Time.formatTime(target.timers[name] - now)}`)
      }
      if (!output.length) return '当前没有生效的定时器。'
      output.unshift('各定时器的生效时间为：')
      return output.join('\n')
    })

  ctx.command('channel/assign [bot]', '受理者账号', { authority: 4 })
    .channelFields(['assignee'])
    .adminChannel(async ({ session, target }, value) => {
      const assignee = value ? session.$bot.parseUser(value) : session.selfId
      if (!assignee) return '参数错误。'
      await ctx.database.createChannel(session.platform, session.channelId, { assignee })
      target._merge({ assignee })
    })

  ctx.command('channel.flag [-s|-S] [...flags]', '标记信息', { authority: 3 })
    .channelFields(['flag'])
    .option('list', '-l  标记列表')
    .option('set', '-s  添加标记', { authority: 4 })
    .option('unset', '-S  删除标记', { authority: 4 })
    .adminChannel(flagAction.bind(null, Channel.Flag))
}
