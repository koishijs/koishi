import { Argv, Awaitable, Channel, Command, difference, Extend, observe, template, User } from 'koishi'

template.set('common', {
  'error-encountered': '发生未知错误。',
})

export function parsePlatform(target: string): [platform: string, id: string] {
  const index = target.indexOf(':')
  const platform = target.slice(0, index)
  const id = target.slice(index + 1)
  return [platform, id] as any
}

export function handleError<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(
  cmd: Command<U, G, A, O>,
  handler: (error: Error, argv: Argv<U, G, A, O>) => Awaitable<void | string>,
) {
  return cmd.action(async (argv, ...args) => {
    try {
      return await argv.next()
    } catch (error) {
      if (handler) return handler(error, argv)
      return template('common.error-encountered', error.message)
    }
  }, true)
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
