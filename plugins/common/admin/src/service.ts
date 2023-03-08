import { Argv, Command, Context, difference, Extend, observe, Service } from 'koishi'

declare module 'koishi' {
  interface Context {
    admin: AdminService
  }
}

export function parsePlatform(target: string): [platform: string, id: string] {
  const index = target.indexOf(':')
  const platform = target.slice(0, index)
  const id = target.slice(index + 1)
  return [platform, id] as any
}

export namespace AdminService {
  export interface Config {
    required?: boolean
  }
}

export class AdminService extends Service {
  constructor(public ctx: Context) {
    super(ctx, 'admin', true)
  }

  user(command: Command, config: AdminService.Config = {}) {
    let notFound = false

    async function setTarget(argv: Argv<'authority', never, any[], Extend<{}, 'user', string>>) {
      const { options, session } = argv
      const { user, app } = session

      if (config.required && !options.user) {
        return session.text('admin.user-expected')
      }

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

    command[Context.current] = this[Context.current]
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

  channel(command: Command, config: AdminService.Config = {}) {
    let notFound = false

    async function setTarget(argv: Argv<never, never, any[], Extend<{}, 'channel', string>>) {
      const { options, session } = argv
      const { app } = session

      if (config.required && !options.channel) {
        return session.text('admin.channel-expected')
      }

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

    command[Context.current] = this[Context.current]
    return command
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
}
