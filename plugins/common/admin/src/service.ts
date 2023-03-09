import { Argv, Command, Context, difference, Extend, observe } from 'koishi'
import { parsePlatform } from './utils'

declare module 'koishi' {
  namespace Command {
    interface Config {
      admin?: Config.Admin
    }

    namespace Config {
      interface Admin {
        user?: boolean
        channel?: boolean
        upsert?: boolean
      }
    }
  }
}

export const name = 'admin-service'

export function apply(ctx: Context) {
  function enableAdmin(command: Command) {
    if (!command.config.admin) return
    command[Context.current] = ctx
    if (command.config.admin.user) adminUser(command)
    if (command.config.admin.channel) adminChannel(command)
  }

  ctx.$commander._commandList.forEach(enableAdmin)
  ctx.on('command-added', enableAdmin)
}

function adminUser(command: Command) {
  let notFound: boolean

  async function setTarget(argv: Argv<'authority', never, any[], Extend<{}, 'user', string>>) {
    const { options, session } = argv
    const { user, app } = session
    notFound = false

    // user not specified, use current user
    if (!options.user) return

    // spectified user is identical to current user
    const [platform, userId] = parsePlatform(options.user)
    if (session.userId === userId && session.platform === platform) return

    // get target user
    const fields = session.collect('user', argv)
    const data = await app.database.getUser(platform, userId, [...fields])

    if (!data) {
      notFound = true
      const temp = app.model.tables.user.create()
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

  return command
    .option('user', '-u [user:user]', { authority: 3, descPath: 'admin.user-option' })
    .userFields(['authority'])
    .action(async (argv, ...args) => {
      const { session, next } = argv
      const user = session.user
      const output = await setTarget(argv)
      if (output) return output
      try {
        const diffKeys = Object.keys(session.user.$diff)
        const result = await next()
        if (notFound && !command.config.admin.upsert) {
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

function adminChannel(command: Command) {
  let notFound: boolean

  async function setTarget(argv: Argv<never, never, any[], Extend<{}, 'channel', string>>) {
    const { options, session } = argv
    const { app } = session
    notFound = false

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

  return command
    .option('channel', '-c [channel:channel]', { authority: 3, descPath: 'admin.channel-option' })
    .action(async (argv, ...args) => {
      const { session, next } = argv
      const channel = session.channel
      const output = await setTarget(argv)
      if (output) return output
      try {
        const diffKeys = Object.keys(session.channel.$diff)
        const result = await next()
        if (notFound && !command.config.admin.upsert) {
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
