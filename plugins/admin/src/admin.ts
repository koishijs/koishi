import { difference, observe, Time, enumKeys, template, Context, User, Channel, Command, Observed } from 'koishi'

declare module 'koishi' {
  interface Argv<U, G, A, O> {
    user?: User.Observed<U | 'authority'>
    channel?: Channel.Observed<G>
    target?: Observed<any>
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
  'user-expected': '请指定目标用户。',
  'user-not-found': '未找到指定的用户。',
  'user-unchanged': '用户数据未改动。',
  'user-updated': '用户数据已修改。',
  'channel-not-found': '未找到指定的频道。',
  'channel-unchanged': '频道数据未改动。',
  'channel-updated': '频道数据已修改。',
  'invalid-assignee-platform': '代理者应与目标频道属于同一平台。',
  'not-in-group': '当前不在群组上下文中，请使用 -t 参数指定目标频道。',
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

function parsePlatform(target: string): [platform: string, id: string] {
  const index = target.indexOf(':')
  const platform = target.slice(0, index)
  const id = target.slice(index + 1)
  return [platform, id] as any
}

function adminFlag<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>, map: any) {
  return cmd
    .option('list', '-l  标记列表')
    .option('set', '-s  添加标记', { authority: 4 })
    .option('unset', '-S  删除标记', { authority: 4 })
    .action(async ({ options, target }, ...args) => {
      if (options.set || options.unset) {
        const notFound = difference(args, enumKeys(map))
        if (notFound.length) return template('admin.unknown-flag', notFound.join(', '))
        for (const name of args) {
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
    })
}

export function adminUser<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>, autoCreate = false) {
  cmd.config.checkUnknown = true

  return cmd
    .option('target', '-t [user:user]  指定目标用户', { authority: 3 })
    .userFields(['authority'])
    .userFields(({ session, options }, fields) => {
      const platform = options.target ? options.target.split(':')[0] : session.platform
      fields.add(platform as never)
    })
    .action(async (argv, ...args) => {
      const { options, session: { user, app }, next } = argv
      const fields = argv.session.collect('user', argv)
      let session = argv.session
      if (!options.target) {
        argv.user = await argv.session.observeUser(fields)
      } else {
        const [platform, userId] = parsePlatform(options.target)
        if (user[platform] === userId) {
          argv.user = await argv.session.observeUser(fields)
        } else {
          const data = await app.database.getUser(platform, userId, [...fields])
          if (!data) {
            if (!autoCreate) return template('admin.user-not-found')
            const temp = app.model.create('user')
            temp[platform] = userId
            const fallback = observe(temp, async () => {
              if (!fallback.authority) return
              await app.database.createUser(platform, userId, fallback)
            })
            argv.user = fallback
          } else if (user.authority <= data.authority) {
            return template('internal.low-authority')
          } else {
            argv.user = observe(data, diff => app.database.setUser(platform, userId, diff), `user ${options.target}`)
            if (!autoCreate) {
              session = Object.create(argv.session)
              session.user = argv.user
              session.userId = userId
              session.platform = platform
            }
          }
        }
      }
      argv.target = argv.user
      const diffKeys = Object.keys(argv.user.$diff)
      const result = await next()
      if (typeof result === 'string') return result
      if (!difference(Object.keys(argv.user.$diff), diffKeys).length) {
        return template('admin.user-unchanged')
      }
      await argv.user.$update()
      return template('admin.user-updated')
    }, true)
}

export function adminChannel<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>, autoCreate = false) {
  cmd.config.checkUnknown = true

  return cmd
    .userFields(['authority'])
    .option('target', '-t [channel:channel]  指定目标频道', { authority: 3 })
    .action(async (argv, ...args) => {
      const { options, session: { app, cid, subtype }, next } = argv
      const fields = argv.session.collect('channel', argv)
      let session = argv.session
      if ((!options.target || options.target === cid) && subtype === 'group') {
        argv.channel = await argv.session.observeChannel(fields)
      } else if (options.target) {
        const [platform, channelId] = parsePlatform(options.target)
        const data = await app.database.getChannel(platform, channelId, [...fields])
        if (!data) {
          if (!autoCreate) return template('admin.channel-not-found')
          const temp = app.model.create('channel')
          temp.platform = platform
          temp.id = channelId
          const fallback = observe(temp, async () => {
            if (!fallback.assignee) return
            await app.database.createChannel(platform, channelId, fallback)
          })
          argv.channel = fallback
        } else {
          argv.channel = observe(data, diff => app.database.setChannel(platform, channelId, diff), `channel ${options.target}`)
          if (!autoCreate) {
            session = Object.create(argv.session)
            session.channel = argv.channel
            session.channelId = channelId
            session.platform = platform
          }
        }
      } else {
        return template('admin.not-in-group')
      }
      argv.target = argv.channel
      const result = await next()
      if (typeof result === 'string') return result
      if (!Object.keys(argv.channel.$diff).length) {
        return template('admin.channel-unchanged')
      }
      await argv.channel.$update()
      return template('admin.channel-updated')
    })
}

export const name = 'admin'

export function apply(ctx: Context) {
  ctx.command('common/user', '用户管理', { authority: 3 })
  ctx.command('common/channel', '频道管理', { authority: 3 })

  ctx.command('user/authorize <value:natural>', '权限信息', { authority: 4 })
    .alias('auth')
    .use(adminUser, true)
    .action(async ({ session, user }, authority) => {
      if (session.userId === user[session.platform]) return template('admin.user-expected')
      if (authority >= session.user.authority) return template('internal.low-authority')
      if (authority === user.authority) return template('admin.user-unchanged')
      user.authority = authority
    })

  ctx.command('user.flag [-s|-S] [...flags]', '标记信息', { authority: 3 })
    .userFields(['flag'])
    .use(adminUser)
    .use(adminFlag, User.Flag)

  ctx.command('user.usage [key] [value:posint]', '调用次数信息', { authority: 1 })
    .userFields(['usage'])
    .option('set', '-s  设置调用次数', { authority: 4 })
    .option('clear', '-c  清空调用次数', { authority: 4 })
    .use(adminUser)
    .action(({ user, options }, name, count) => {
      if (options.clear) {
        name ? delete user.usage[name] : user.usage = {}
        return
      }

      if (options.set) {
        if (!count) return template('internal.insufficient-arguments')
        user.usage[name] = count
        return
      }

      if (name) return template('usage.present', name, user.usage[name] || 0)
      const output: string[] = []
      for (const name of Object.keys(user.usage).sort()) {
        if (name.startsWith('$')) continue
        output.push(`${name}：${user.usage[name]}`)
      }
      if (!output.length) return template('usage.none')
      output.unshift(template('usage.list'))
      return output.join('\n')
    })

  ctx.command('user.timer [key] [value:date]', '定时器信息', { authority: 1 })
    .userFields(['timers'])
    .option('set', '-s  设置定时器', { authority: 4 })
    .option('clear', '-c  清空定时器', { authority: 4 })
    .use(adminUser)
    .action(({ user, options }, name, value) => {
      if (options.clear) {
        name ? delete user.timers[name] : user.timers = {}
        return
      }

      if (options.set) {
        if (!value) return template('internal.insufficient-arguments')
        user.timers[name] = +value
        return
      }

      const now = Date.now()
      if (name) {
        const delta = user.timers[name] - now
        if (delta > 0) return template('timer.present', name, Time.formatTime(delta))
        return template('timer.absent', name)
      }
      const output: string[] = []
      for (const name of Object.keys(user.timers).sort()) {
        if (name.startsWith('$')) continue
        output.push(`${name}：剩余 ${Time.formatTime(user.timers[name] - now)}`)
      }
      if (!output.length) return template('timer.none')
      output.unshift(template('timer.list'))
      return output.join('\n')
    })

  ctx.command('channel/assign [bot:user]', '受理者账号', { authority: 4 })
    .channelFields(['assignee'])
    .option('noTarget', '-T  移除受理者')
    .use(adminChannel, true)
    .action(async ({ session, options, channel }, value) => {
      if (options.noTarget) {
        channel.assignee = ''
      } else if (!value) {
        channel.assignee = session.selfId
      } else {
        const [platform, userId] = parsePlatform(value)
        if (platform !== parsePlatform(options.target)[0]) {
          return template('admin.invalid-assignee-platform')
        }
        channel.assignee = userId
      }
    })

  ctx.command('channel.flag [-s|-S] [...flags]', '标记信息', { authority: 3 })
    .channelFields(['flag'])
    .use(adminChannel)
    .use(adminFlag, Channel.Flag)
}
