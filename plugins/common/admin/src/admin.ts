import { Argv, difference, observe, enumKeys, template, Context, User, Channel, Command, Extend } from 'koishi'

declare module 'koishi' {
  namespace Command {
    interface Config {
      adminUser?: boolean
      adminChannel?: boolean
    }
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
  'not-in-group': '当前不在群组上下文中，请使用 -c 参数指定目标频道。',
})

function parsePlatform(target: string): [platform: string, id: string] {
  const index = target.indexOf(':')
  const platform = target.slice(0, index)
  const id = target.slice(index + 1)
  return [platform, id] as any
}

function adminFlag<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>, map: any, key: 'user' | 'channel') {
  return cmd
    .option('list', '-l  标记列表')
    .option('set', '-s  添加标记', { authority: 4 })
    .option('unset', '-S  删除标记', { authority: 4 })
    .action(async ({ options, session }, ...args) => {
      const target = session[key] as any

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

export function adminUser<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>) {
  let notFound = false

  async function setTarget(argv: Argv<'authority', G, A, Extend<O, 'user', string>>) {
    const { options, session } = argv
    const { user, app } = session

    // user not specified, use current user
    if (!options.user) return

    // spectified user is identical to current user
    const [platform, userId] = parsePlatform(options.user)
    if (session.user[platform] === userId) return

    // get target user
    const fields = session.collect('user', argv)
    const data = await app.database.getUser(platform, userId, [...fields])

    if (!data) {
      notFound = true
      const temp = app.model.create('user')
      temp[platform] = userId
      session.user = observe(temp, async (diff) => {
        await app.database.createUser(platform, userId, diff)
      }, `user ${options.user}`)
    } else if (user.authority <= data.authority) {
      return template('internal.low-authority')
    } else {
      session.user = observe(data, async (diff) => {
        await app.database.setUser(platform, userId, diff)
      }, `user ${options.user}`)
    }
  }

  return cmd
    .option('user', '-u [user:user]  指定目标用户', { authority: 3 })
    .userFields(['authority'])
    .userFields(({ session, options }, fields) => {
      const platform = options.user ? options.user.split(':')[0] : session.platform
      fields.add(platform as never)
    })
    .action(async (argv, ...args) => {
      const { session, next } = argv
      const user = session.user
      const output = await setTarget(argv)
      if (output) return output
      try {
        const diffKeys = Object.keys(session.user.$diff)
        const result = await next()
        if (notFound && !session.user.authority) {
          return template('admin.user-not-found')
        } else if (typeof result === 'string') {
          return result
        } else if (!difference(Object.keys(session.user.$diff), diffKeys).length) {
          return template('admin.user-unchanged')
        } else if (session.user !== user && session.user.authority >= user.authority) {
          return template('internal.low-authority')
        }
        await session.user.$update()
        return template('admin.user-updated')
      } finally {
        session.user = user
      }
    }, true)
}

export function adminChannel<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>) {
  let notFound = false

  async function setTarget(argv: Argv<U, G, A, Extend<O, 'channel', string>>) {
    const { options, session } = argv
    const { app } = session

    // channel is required for private messages
    if (session.subtype === 'private' && !options.channel) {
      return template('admin.not-in-group')
    }

    // channel not specified or identical, use current channel
    if (!options.channel || options.channel === session.cid) return

    // get target channel
    const [platform, channelId] = parsePlatform(options.channel)
    const fields = argv.session.collect('channel', argv)
    const data = await app.database.getChannel(platform, channelId, [...fields])

    if (!data) {
      notFound = true
      const temp = app.model.create('channel')
      temp.platform = platform
      temp.id = channelId
      session.channel = observe(temp, async (diff) => {
        await app.database.createChannel(platform, channelId, diff)
      }, `channel ${options.channel}`)
    } else {
      session.channel = observe(data, async (diff) => {
        app.database.setChannel(platform, channelId, diff)
      }, `channel ${options.channel}`)
    }
  }

  return cmd
    .channelFields(['assignee'])
    .option('channel', '-c [channel:channel]  指定目标频道', { authority: 3 })
    .action(async (argv, ...args) => {
      const { session, next } = argv
      const channel = session.channel
      const output = await setTarget(argv)
      if (output) return output
      try {
        const diffKeys = Object.keys(session.channel.$diff)
        const result = await next()
        if (notFound && !session.channel.assignee) {
          return template('admin.channel-not-found')
        } else if (typeof result === 'string') {
          return result
        } else if (!difference(Object.keys(session.channel.$diff), diffKeys).length) {
          return template('admin.channel-unchanged')
        }
        await session.channel.$update()
        return template('admin.channel-updated')
      } finally {
        session.channel = channel
      }
    }, true)
}

export const name = 'admin'

export function apply(ctx: Context) {
  function checkConfig(cmd: Command) {
    if (cmd.config.adminUser) cmd.use(adminUser)
    if (cmd.config.adminChannel) cmd.use(adminChannel)
  }

  for (const command of ctx.app._commandList) {
    checkConfig(command)
  }

  ctx.on('command-added', checkConfig)

  ctx.command('user', '用户管理', { authority: 3 })
  ctx.command('channel', '频道管理', { authority: 3 })

  ctx.command('user/authorize <value:natural>', '权限信息', { authority: 4, checkUnknown: true })
    .alias('auth')
    .use(adminUser)
    .action(async ({ session }, authority) => {
      if (session.userId === session.user[session.platform]) return template('admin.user-expected')
      session.user.authority = authority
    })

  ctx.command('user.flag [-s|-S] [...flags]', '标记信息', { authority: 3, checkUnknown: true })
    .userFields(['flag'])
    .use(adminFlag, User.Flag, 'user')
    .use(adminUser)

  ctx.command('channel/assign [bot:user]', '受理者账号', { authority: 4, checkUnknown: true })
    .channelFields(['assignee'])
    .option('noTarget', '-T  移除受理者')
    .use(adminChannel)
    .action(async ({ session, options }, value) => {
      if (options.noTarget) {
        session.channel.assignee = ''
      } else if (!value) {
        session.channel.assignee = session.selfId
      } else {
        const [platform, userId] = parsePlatform(value)
        if (platform !== parsePlatform(options.channel)[0]) {
          return template('admin.invalid-assignee-platform')
        }
        session.channel.assignee = userId
      }
    })

  ctx.command('channel.flag [-s|-S] [...flags]', '标记信息', { authority: 3, checkUnknown: true })
    .channelFields(['flag'])
    .use(adminFlag, Channel.Flag, 'channel')
    .use(adminChannel)
}
