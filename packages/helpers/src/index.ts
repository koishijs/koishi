import { App, Argv, Awaitable, Channel, Command, difference, Extend, observe, User } from 'koishi'
import zh from './locales/zh.yml'
import en from './locales/en.yml'
import ja from './locales/ja.yml'
import fr from './locales/fr.yml'
import zhTW from './locales/zh-tw.yml'

export function parsePlatform(target: string): [platform: string, id: string] {
  const index = target.indexOf(':')
  const platform = target.slice(0, index)
  const id = target.slice(index + 1)
  return [platform, id] as any
}

const refs = new WeakSet<App>()

function loadI18n(app: App) {
  if (refs.has(app)) return
  refs.add(app)
  app.i18n.define('zh', zh)
  app.i18n.define('en', en)
  app.i18n.define('ja', ja)
  app.i18n.define('fr', fr)
  app.i18n.define('zh-tw', zhTW)
}

export function handleError<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(
  cmd: Command<U, G, A, O>,
  handler: (error: Error, argv: Argv<U, G, A, O>) => Awaitable<void | string>,
) {
  loadI18n(cmd.ctx.app)

  return cmd.action(async (argv, ...args) => {
    try {
      return await argv.next()
    } catch (error) {
      if (handler) return handler(error, argv)
      return argv.session.text('internal.error-encountered', error.message)
    }
  }, true)
}

export function adminUser<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>) {
  let notFound = false
  loadI18n(cmd.ctx.app)

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
      const temp = app.model.tables.user.create()
      temp[platform] = userId
      session.user = observe(temp, async (diff) => {
        await app.database.createUser(platform, userId, diff)
      }, `user ${options.user}`)
    } else if (user.authority <= data.authority) {
      return session.text('internal.low-authority')
    } else {
      session.user = observe(data, async (diff) => {
        await app.database.setUser(platform, userId, diff)
      }, `user ${options.user}`)
    }
  }

  return cmd
    .option('user', '-u [user:user]', { authority: 3, descPath: 'admin.user-option' })
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
          return session.text('admin.user-not-found')
        } else if (typeof result === 'string') {
          return result
        } else if (!difference(Object.keys(session.user.$diff), diffKeys).length) {
          return session.text('admin.user-unchanged')
        } else if (session.user !== user && session.user.authority >= user.authority) {
          return session.text('internal.low-authority')
        }
        await session.user.$update()
        return session.text('admin.user-updated')
      } finally {
        session.user = user
      }
    }, true)
}

export function adminChannel<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>) {
  let notFound = false
  loadI18n(cmd.ctx.app)

  async function setTarget(argv: Argv<U, G, A, Extend<O, 'channel', string>>) {
    const { options, session } = argv
    const { app } = session

    // channel is required for private messages
    if (session.subtype === 'private' && !options.channel) {
      return session.text('admin.not-in-group')
    }

    // channel not specified or identical, use current channel
    const { channel = session.cid } = options
    if (channel === session.cid && !session.channel['$detached']) return

    // get target channel
    const [platform, channelId] = parsePlatform(channel)
    const fields = argv.session.collect('channel', argv)
    const data = await app.database.getChannel(platform, channelId, [...fields])

    if (!data) {
      notFound = true
      const temp = app.model.tables.channel.create()
      temp.platform = platform
      temp.id = channelId
      session.channel = observe(temp, async (diff) => {
        await app.database.createChannel(platform, channelId, diff)
      }, `channel ${channel}`)
    } else {
      session.channel = observe(data, async (diff) => {
        await app.database.setChannel(platform, channelId, diff)
      }, `channel ${channel}`)
    }
  }

  return cmd
    .channelFields(['assignee'])
    .option('channel', '-c [channel:channel]', { authority: 3, descPath: 'admin.channel-option' })
    .action(async (argv, ...args) => {
      const { session, next } = argv
      const channel = session.channel
      const output = await setTarget(argv)
      if (output) return output
      try {
        const diffKeys = Object.keys(session.channel.$diff)
        const result = await next()
        if (notFound && !session.channel.assignee) {
          return session.text('admin.channel-not-found')
        } else if (typeof result === 'string') {
          return result
        } else if (!difference(Object.keys(session.channel.$diff), diffKeys).length) {
          return session.text('admin.channel-unchanged')
        }
        await session.channel.$update()
        return session.text('admin.channel-updated')
      } finally {
        session.channel = channel
      }
    }, true)
}
