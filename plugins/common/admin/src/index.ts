import { Channel, Command, Context, Schema, User } from 'koishi'
import { parsePlatform } from './utils'
import * as service from './service'
import zhCN from './locales/zh-CN.yml'
import enUS from './locales/en-US.yml'
import jaJP from './locales/ja-JP.yml'
import frFR from './locales/fr-FR.yml'
import zhTW from './locales/zh-TW.yml'

export * from './service'

type Key = 'user' | 'channel'

function adminLocale<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>, key: Key) {
  return cmd
    .option('remove', '-r', { descPath: 'admin.options.remove' })
    .action(async ({ session, options }, ...args) => {
      const target = session[key] as { locales?: string[] }
      if (options.remove) {
        target.locales = []
      } else if (args[0]) {
        target.locales = [args[0]]
      } else if (target.locales?.length) {
        return session.text('admin.current-locale', [target.locales.join(', ')])
      } else {
        return session.text('admin.no-locale')
      }
    })
}

export interface Config {}

export const name = 'admin'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.i18n.define('zh-CN', zhCN)
  ctx.i18n.define('en-US', enUS)
  ctx.i18n.define('ja-JP', jaJP)
  ctx.i18n.define('fr-FR', frFR)
  ctx.i18n.define('zh-TW', zhTW)

  ctx.plugin(service)

  ctx.command('user', { authority: 3 })
  ctx.command('channel', { authority: 3 })

  ctx.command('user/authorize <value:natural>', { authority: 4, checkUnknown: true, admin: { user: true, upsert: true } })
    .alias('auth')
    .userFields(['authority'])
    .action(async ({ options, session }, authority) => {
      if (!options['user']) {
        return session.text('admin.user-expected')
      }
      session.user.authority = authority
    })

  ctx.command('user.locale <lang>', { authority: 1, checkUnknown: true, admin: { user: true } })
    .userFields(['locales'])
    .use(adminLocale, 'user')

  ctx.command('channel/assign [bot:user]', { authority: 4, checkUnknown: true, admin: { channel: true, upsert: true } })
    .channelFields(['assignee'])
    .option('remove', '-r', { descPath: 'admin.options.remove' })
    .action(async ({ session, options }, value) => {
      if (options.remove) {
        session.channel.assignee = ''
      } else if (!value) {
        session.channel.assignee = session.selfId
      } else {
        const [platform, userId] = parsePlatform(value)
        if (platform !== session.platform) {
          return session.text('admin.invalid-assignee-platform')
        }
        session.channel.assignee = userId
      }
    })

  ctx.command('channel.locale <lang>', { authority: 3, checkUnknown: true, admin: { channel: true } })
    .channelFields(['locales'])
    .use(adminLocale, 'channel')
}
