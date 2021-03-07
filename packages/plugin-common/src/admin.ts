import { difference, observe, Time, enumKeys, Random, template, deduplicate } from 'koishi-utils'
import { Context, User, Channel, Command, Argv, Platform, Session } from 'koishi-core'

type AdminAction<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}, T>
  = (argv: Argv<U | 'authority', G, A, O> & { target: T }, ...args: A)
    => void | string | Promise<void | string>

declare module 'koishi-core' {
  interface Command<U, G, A, O> {
    adminUser(callback: AdminAction<U, G, A, O, User.Observed<U | 'authority'>>): this
    adminChannel(callback: AdminAction<U, G, A, O, Channel.Observed<G>>): this
  }

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
  'generated-1': [
    '请在 5 分钟内使用你的账号在要绑定的平台内向机器人发送以下文本：',
    '{0}',
    '注意：每个账号只能绑定到每个平台一次，此操作将会抹去你当前平台上的数据，请谨慎操作！',
  ].join('\n'),
  'generated-2': [
    '令牌核验成功！下面将进行第二步操作。',
    '请在 5 分钟内使用你的账号在之前的平台内向机器人发送以下文本：',
    '{0}',
  ].join('\n'),
  'failed': '账号绑定失败：你已经绑定过该平台。',
  'success': '账号绑定成功！',
})

template.set('usage', {
  'present': '今日 {0} 功能的调用次数为：{1}',
  'list': '今日各功能的调用次数为：',
  'none': '今日没有调用过消耗次数的功能。',
})

template.set('timer', {
  'present': '定时器 {0} 的生效时间为：剩余 {1}',
  'absent': '定时器 {0} 当前并未生效。',
  'list': '各定时器的生效时间为：',
  'none': '当前没有生效的定时器。',
})

template.set('switch', {
  'forbidden': '您无权修改 {0} 功能。',
  'list': '当前禁用的功能有：{0}',
  'none': '当前没有禁用功能。',
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
  const { database } = this.app
  const command = this
    .userFields(['authority'])
    .option('target', '-t [user:user]  指定目标用户', { authority: 3 })
    .userFields(({ options }, fields) => {
      if (!options.target) return
      const [platform] = options.target.split(':')
      fields.add(platform as Platform)
    })

  command._actions.unshift(async (argv) => {
    const { options, session, args } = argv
    const fields = session.collect('user', argv)
    let target: User.Observed<never>
    if (!options.target) {
      target = await session.observeUser(fields)
    } else {
      const [platform, userId] = Argv.parsePid(options.target)
      if (session.user[platform] === userId) {
        target = await session.observeUser(fields)
      } else {
        const data = await database.getUser(platform, userId, [...fields])
        if (!data) return template('admin.user-not-found')
        if (session.user.authority <= data.authority) {
          return template('internal.low-authority')
        } else {
          target = observe(data, diff => database.setUser(platform, userId, diff), `user ${options.target}`)
        }
      }
    }
    const diffKeys = Object.keys(target._diff)
    const result = await callback({ ...argv, target }, ...args)
    if (typeof result === 'string') return result
    if (!difference(Object.keys(target._diff), diffKeys).length) {
      return template('admin.user-unchanged')
    }
    await target._update()
    return template('admin.user-updated')
  })

  return command
}

Command.prototype.adminChannel = function (this: Command, callback) {
  const { database } = this.app
  const command = this
    .userFields(['authority'])
    .option('target', '-t [channel:channel]  指定目标频道', { authority: 3 })

  command._actions.unshift(async (argv, ...args) => {
    const { options, session } = argv
    const fields = session.collect('channel', argv)
    let target: Channel.Observed
    if ((!options.target || options.target === session.cid) && session.subtype === 'group') {
      target = await session.observeChannel(fields)
    } else if (options.target) {
      const [platform, channelId] = Argv.parsePid(options.target)
      const data = await database.getChannel(platform, channelId, [...fields])
      if (!data) return template('admin.channel-not-found')
      target = observe(data, diff => database.setChannel(platform, channelId, diff), `channel ${options.target}`)
    } else {
      return template('admin.not-in-group')
    }
    const result = await callback({ ...argv, target }, ...args)
    if (typeof result === 'string') return result
    if (!Object.keys(target._diff).length) {
      return template('admin.channel-unchanged')
    }
    await target._update()
    return template('admin.channel-updated')
  })

  return command
}

export interface AdminConfig {
  admin?: boolean
  generateToken?: () => string
}

export default function apply(ctx: Context, config: AdminConfig = {}) {
  if (config.admin === false) return
  ctx = ctx.select('database')

  ctx.command('common/user', '用户管理', { authority: 3 })
  ctx.command('common/channel', '频道管理', { authority: 3 })

  ctx.command('common/callme [name:text]', '修改自己的称呼')
    .userFields(['id', 'name'])
    .shortcut('叫我', { prefix: true, fuzzy: true, greedy: true })
    .action(async ({ session }, name) => {
      const { user } = session
      if (!name) {
        if (user.name) {
          return template('callme.current', session.username)
        } else {
          return template('callme.unnamed')
        }
      } else if (name === user.name) {
        return template('callme.unchanged')
      } else if (!(name = name.trim())) {
        return template('callme.empty')
      } else if (name.includes('[CQ:')) {
        return template('callme.invalid')
      }

      const result = ctx.bail('common/callme', name, session)
      if (result) return result

      try {
        user.name = name
        await user._update()
        return template('callme.updated', session.username)
      } catch (error) {
        if (error[Symbol.for('koishi.error-type')] === 'duplicate-entry') {
          return template('callme.duplicate')
        } else {
          ctx.logger('common').warn(error)
          return template('callme.failed')
        }
      }
    })

  // 1: group (1st step)
  // 0: private
  // -1: group (2nd step)
  type TokenData = [platform: Platform, id: string, pending: number]
  const tokens: Record<string, TokenData> = {}

  const { generateToken = () => 'koishi/' + Random.uuid() } = config

  function generate(session: Session, pending: number) {
    const token = generateToken()
    tokens[token] = [session.platform, session.userId, pending]
    setTimeout(() => delete tokens[token], 5 * Time.minute)
    return token
  }

  ctx.command('user/bind', '绑定到账号', { authority: 0 })
    .action(({ session }) => {
      const token = generate(session, +(session.subtype === 'group'))
      return template('bind.generated-1', token)
    })

  ctx.middleware(async (session, next) => {
    const data = tokens[session.content]
    if (!data) return next()
    if (data[2] < 0) {
      const sess = new Session(ctx.app, { ...session, platform: data[0], userId: data[1] })
      const user = await sess.observeUser([session.platform])
      user[session.platform] = session.userId as never
      delete tokens[session.content]
      await user._update()
      return session.send(template('bind.success'))
    } else {
      const user = await session.observeUser(['authority', data[0]])
      if (!user.authority) return session.send(template('internal.low-authority'))
      if (user[data[0]]) return session.send(template('bind.failed'))
      delete tokens[session.content]
      if (data[2]) {
        const token = generate(session, -1)
        return session.send(template('bind.generated-2', token))
      } else {
        user[data[0] as any] = data[1]
        await user._update()
        return session.send(template('bind.success'))
      }
    }
  }, true)

  ctx.command('user/authorize <value:posint>', '权限信息', { authority: 4 })
    .alias('auth')
    .adminUser(async ({ session, target }, authority) => {
      if (authority >= session.user.authority) return template('internal.low-authority')
      if (authority === target.authority) return template('admin.user-unchanged')
      await ctx.database.createUser(session.platform, target[session.platform], { authority })
      target._merge({ authority })
      return template('admin.user-updated')
    })

  ctx.command('user.flag [-s|-S] [...flags]', '标记信息', { authority: 3 })
    .userFields(['flag'])
    .option('list', '-l  标记列表')
    .option('set', '-s  添加标记', { authority: 4 })
    .option('unset', '-S  删除标记', { authority: 4 })
    .adminUser(flagAction.bind(null, User.Flag))

  ctx.command('user.usage [key] [value:posint]', '调用次数信息', { authority: 1 })
    .userFields(['usage'])
    .option('set', '-s  设置调用次数', { authority: 4 })
    .option('clear', '-c  清空调用次数', { authority: 4 })
    .adminUser(({ target, options }, name, count) => {
      if (options.clear) {
        name ? delete target.usage[name] : target.usage = {}
        return
      }

      if (options.set) {
        if (!count) return template('internal.insufficient-arguments')
        target.usage[name] = count
        return
      }

      if (name) return template('usage.present', name, target.usage[name] || 0)
      const output: string[] = []
      for (const name of Object.keys(target.usage).sort()) {
        if (name.startsWith('$')) continue
        output.push(`${name}：${target.usage[name]}`)
      }
      if (!output.length) return template('usage.none')
      output.unshift(template('usage.list'))
      return output.join('\n')
    })

  ctx.command('user.timer [key] [value:date]', '定时器信息', { authority: 1 })
    .userFields(['timers'])
    .option('set', '-s  设置定时器', { authority: 4 })
    .option('clear', '-c  清空定时器', { authority: 4 })
    .adminUser(({ target, options }, name, value) => {
      if (options.clear) {
        name ? delete target.timers[name] : target.timers = {}
        return
      }

      if (options.set) {
        if (!value) return template('internal.insufficient-arguments')
        target.timers[name] = +value
        return
      }

      const now = Date.now()
      if (name) {
        const delta = target.timers[name] - now
        if (delta > 0) return template('timer.present', name, Time.formatTime(delta))
        return template('timer.absent', name)
      }
      const output: string[] = []
      for (const name of Object.keys(target.timers).sort()) {
        if (name.startsWith('$')) continue
        output.push(`${name}：剩余 ${Time.formatTime(target.timers[name] - now)}`)
      }
      if (!output.length) return template('timer.none')
      output.unshift(template('timer.list'))
      return output.join('\n')
    })

  ctx.command('channel/assign [bot:user]', '受理者账号', { authority: 4 })
    .channelFields(['assignee'])
    .adminChannel(async ({ session, target }, value) => {
      const assignee = value ? Argv.parsePid(value)[1] : session.selfId
      if (assignee === target.assignee) return template('admin.channel-unchanged')
      await ctx.database.createChannel(session.platform, session.channelId, { assignee })
      target._merge({ assignee })
      return template('admin.channel-updated')
    })

  ctx.command('channel/switch <command...>', '启用和禁用功能', { authority: 3 })
    .channelFields(['disable'])
    .userFields(['authority'])
    .adminChannel(({ session, target: { disable } }, ...names: string[]) => {
      if (!names.length) {
        if (!disable.length) return template('switch.none')
        return template('switch.list', disable.join(', '))
      }

      names = deduplicate(names)
      const forbidden = names.filter(name => {
        const command = ctx.app._commandMap[name]
        return command && command.config.authority >= session.user.authority
      })
      if (forbidden.length) return template('switch.forbidden', forbidden.join(', '))

      for (const name of names) {
        const index = disable.indexOf(name)
        if (index >= 0) {
          disable.splice(index)
        } else {
          disable.push(name)
        }
      }
    })

  ctx.command('channel.flag [-s|-S] [...flags]', '标记信息', { authority: 3 })
    .channelFields(['flag'])
    .option('list', '-l  标记列表')
    .option('set', '-s  添加标记', { authority: 4 })
    .option('unset', '-S  删除标记', { authority: 4 })
    .adminChannel(flagAction.bind(null, Channel.Flag))
}
