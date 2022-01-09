import { difference, enumKeys, template, Context, User, Channel, Command } from 'koishi'
import { adminChannel, adminUser, parsePlatform } from '@koishijs/command-utils'

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

export const name = 'admin'

export function apply(ctx: Context) {
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
