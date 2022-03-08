import { Channel, Command, Context, difference, enumKeys, Schema, User } from 'koishi'
import { adminChannel, adminUser, parsePlatform } from '@koishijs/helpers'

function adminFlag<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>, map: any, key: 'user' | 'channel') {
  return cmd
    .option('list', '-l  标记列表')
    .option('set', '-s  添加标记', { authority: 4 })
    .option('unset', '-S  删除标记', { authority: 4 })
    .action(async ({ options, session }, ...args) => {
      const target = session[key] as any

      if (options.set || options.unset) {
        const notFound = difference(args, enumKeys(map))
        if (notFound.length) return session.text('admin.unknown-flag', [notFound.join(', ')])
        for (const name of args) {
          options.set ? target.flag |= map[name] : target.flag &= ~map[name]
        }
        return
      }

      if (options.list) {
        return session.text('admin.all-flags', [enumKeys(map).join(', ')])
      }

      let flag = target.flag
      const keys: string[] = []
      while (flag) {
        const value = 2 ** Math.floor(Math.log2(flag))
        flag -= value
        keys.unshift(map[value])
      }
      if (!keys.length) return session.text('admin.no-flags')
      return session.text('admin.current-flags', [keys.join(', ')])
    })
}

export interface Config {}

export const name = 'admin'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.i18n.define('zh', require('../i18n/zh'))
  ctx.i18n.define('en', require('../i18n/en'))

  ctx.command('user', '用户管理', { authority: 3 })
  ctx.command('channel', '频道管理', { authority: 3 })

  ctx.command('user/authorize <value:natural>', '权限信息', { authority: 4, checkUnknown: true })
    .alias('auth')
    .use(adminUser)
    .action(async ({ session }, authority) => {
      if (session.userId === session.user[session.platform]) return session.text('admin.user-expected')
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
          return session.text('admin.invalid-assignee-platform')
        }
        session.channel.assignee = userId
      }
    })

  ctx.command('channel/localize <lang>', '本地化', { authority: 3, checkUnknown: true })
    .channelFields(['locale'])
    .use(adminChannel)
    .action(async ({ session }, lang) => {
      session.channel.locale = lang
    })

  ctx.command('channel.flag [-s|-S] [...flags]', '标记信息', { authority: 3, checkUnknown: true })
    .channelFields(['flag'])
    .use(adminFlag, Channel.Flag, 'channel')
    .use(adminChannel)
}
