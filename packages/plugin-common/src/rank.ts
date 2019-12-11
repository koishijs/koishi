import { Meta, GroupMemberInfo, UserData, Context, UserField, CommandConfig } from 'koishi-core'
import { getDateNumber, simplify } from 'koishi-utils'

export interface Rank {
  names: string[]
  options?: any
  groupOnly?: boolean
  title?: (meta: Meta, options: any) => string
  value: (user: UserData, meta: Meta, options: any) => number
  fields: UserField[]
  reverse?: boolean
  format?: (value: number) => string
  limit?: number
}

const rankMap: Record<string, Rank> = {}

export function registerRank (name: string, rank: Rank) {
  rankMap[name] = rank
}

registerRank('talkativeness', {
  names: ['发言', '聊天'],
  options: { offset: 1 },
  groupOnly: true,
  title (meta, options) {
    const key = getDateNumber() - options.offset
    const date = new Date(key * 86400000).toLocaleDateString()
    return `本群 ${date} 的发言排行为：`
  },
  value (user, meta, options) {
    const key = getDateNumber() - options.offset
    return (user.talkativeness[key] || {})[meta.groupId] || 0
  },
  fields: ['talkativeness'],
  format: value => value + ' 条',
})

export default function apply (ctx: Context, options: CommandConfig) {
  ctx.command('rank <type>', '显示排行', options)
    .option('-g, --global', '使用全服数据', { authority: 2 })
    .option('--start <index>', '起始排名，默认为 1', { default: 1 })
    .option('--end <index>', '终止排名，默认为 10', { default: 10 })
    .action(async ({ meta, options }, type) => {
      let data: { name: string, user: UserData }[]
      const rank = rankMap[type]
      if (!rank) return meta.$send('无法找到对应的排行。')

      if (meta.messageType === 'private' && !options.global) {
        if (rank.groupOnly) return meta.$send('此排行只针对群。')
        return meta.$send('私聊只能获取全服排行。')
      }

      const { names: [name] } = rank
      Object.assign(options, rank.options)

      if (options.global) {
        const users = await ctx.app.database.getAllUsers(['id', 'name', ...rank.fields])
        data = users.map(user => ({ user, name: user.name }))
      } else {
        let members: GroupMemberInfo[]
        try {
          members = await ctx.sender.getGroupMemberList(meta.groupId)
        } catch (error) {
          return meta.$send('错误：无法获得群成员列表。')
        }
        const users = await ctx.app.database.getUsers(members.map(m => m.userId), ['id', 'name', ...rank.fields])
        data = users.map((user) => {
          if (user.name !== String(user.id)) return { user, name: user.name }
          const member = members.find(m => m.userId === user.id)
          return { user, name: member.card || member.nickname }
        })
      }

      const limit = rank.limit || 0
      const filter = rank.reverse
        ? ({ value }) => value < limit
        : ({ value }) => value > limit

      const sorter = rank.reverse
        ? ({ value: x }, { value: y }) => x < y ? -1 : x > y ? 1 : 0
        : ({ value: x }, { value: y }) => x < y ? 1 : x > y ? -1 : 0

      const formatter = rank.format || (value => String(value))

      const output = data
        .map((user) => ({ ...user, value: rank.value(user.user, meta, options) }))
        .filter(filter)
        .sort(sorter)
        .slice(options.start - 1, options.end)
        .map(({ value, name }, index) => {
          return `${index + options.start}. ${name}：${formatter(value)}`
        })
      output.unshift(rank.title ? rank.title(meta, options) : options.global ? `全服${name}排行为：` : `本群${name}排行为：`)
      return meta.$send(output.join('\n'))
    })

  ctx.middleware((meta, next) => {
    let message = simplify(meta.message).trim()
    message = message.replace(ctx.app.prefixRE, '').trim()
    if (!message.endsWith('排行')) return next()
    message = message.slice(0, -2)
    let global = false
    if (message.startsWith('全服')) {
      global = true
      message = message.slice(2)
    }
    for (const type in rankMap) {
      const { names = [] } = rankMap[type]
      if (names.includes(message)) {
        return ctx.runCommand('rank', meta, [type], { global, start: 1, end: 10 })
      }
    }
    return next()
  })
}
