import { User, Context, Session, GroupMemberInfo } from 'koishi-core'
import { paramCase, camelCase, isInteger } from 'koishi-utils'
import MysqlDatabase from 'koishi-plugin-mysql'

type ExtendedUser<T extends User.Field = User.Field> = Pick<User, T> & { _value: number }

interface Rank<T extends User.Field = never> {
  names: string[]
  groupOnly?: boolean
  fields?: Iterable<T>
  reverse?: boolean
  // 如果是函数，则会用于本地计算；如果是字符串，则会用于服务端计算
  value?: string | ((user: ExtendedUser<'id' | 'name' | T>) => number)
  format?: string | ((user: ExtendedUser<'id' | 'name' | T>) => string)
  threshold?: number | string
  order?: string
  limit?: number
}

const ranks: Record<string, Rank<User.Field>> = {}
const rankMap: Record<string, string> = {}

namespace Rank {
  interface Options<T extends User.Field> extends Pick<Rank<T>, 'threshold' | 'format' | 'reverse' | 'fields' | 'order'> {
    key: User.Field
  }

  export function add<T extends User.Field = never>(id: string, rank: Rank<T>) {
    ranks[id] = rank
    rank.names.forEach(name => rankMap[name] = id)
  }

  export function value<T extends User.Field = never>(id: string, names: string[], value: string, options: Partial<Options<T>> = {}) {
    const { threshold = 0, key } = options
    add(id, { names, value, threshold, ...options })
    if (!key) return
    MysqlDatabase.tables.user[key] = () => `IF(\
      ${typeof threshold === 'string' ? threshold : `${value} > ${threshold}`},\
      (SELECT COUNT(*) + 1 FROM \`user\` WHERE ${value} > (SELECT ${value} FROM \`user\` WHERE \`id\` = _user.id)),\
      0\
    )`
  }

  export async function show<T extends User.Field>(rank: Rank<T>, session: Session, options: any) {
    if (rank.groupOnly && (session.subtype !== 'group' || options.global)) {
      return '此排行只针对群。'
    }

    if (session.subtype !== 'group' && !options.global) {
      return '非群聊只能获取全服排行。'
    }

    const { length } = options
    if (!isInteger(length) || length <= 0 || length > 30) {
      return '排名长度应为 1-30 之间的整数。'
    }

    const { reverse, fields = [], format = '', names: [name], limit, order, value } = rank
    let { threshold = 0 } = rank
    if (options.threshold) {
      if (typeof threshold === 'string') return '此排名不支持手动设置阈值。'
      if (typeof options.threshold !== 'number') return '请输入正确的阈值数字。'
      if (reverse ? options.threshold > threshold : options.threshold < threshold) return '请输入正确的阈值数字。'
      threshold = options.threshold
    }

    let data: ExtendedUser[]
    let prefix: string, postfix = ''
    const db = session.database
    const conditionals: string[] = []
    const staticFields = Array.from(fields) as User.Field[]
    if (!staticFields.includes('id')) staticFields.push('id')
    if (!staticFields.includes('name')) staticFields.push('name')
    const keys = db.inferFields('user', staticFields)

    // prepare sql
    if (typeof value === 'function') {
      prefix = `SELECT ${db.joinKeys(keys)} FROM \`user\` _user`
      if (order) postfix = ` ORDER BY ${order} LIMIT ${limit}`
      if (typeof threshold === 'string') conditionals.push(threshold)
    } else {
      prefix = `SELECT ${db.joinKeys(keys)}, ${value} AS \`_value\` FROM \`user\``
      postfix = ` ORDER BY \`_value\`${reverse ? '' : ' DESC'}${order ? ', ' + order : ''} LIMIT ${length}`
      if (typeof threshold === 'string') {
        conditionals.push(threshold)
      } else {
        conditionals.push(`${value} ${reverse ? '<' : '>'} ${threshold}`)
      }
    }

    // fetch data
    if (options.global) {
      data = await db.query<ExtendedUser[]>(`${prefix}${conditionals.length ? ' WHERE ' + conditionals.join(' AND ') : ''}${postfix}`)
    } else {
      let members: GroupMemberInfo[]
      try {
        members = await session.$bot.getGroupMemberList(session.groupId)
      } catch (error) {
        return '无法获得群成员列表。'
      }
      conditionals.push(`\`${session.platform}\` IN (${members.map(m => m.userId).join(', ')})`)
      const users = await db.query<ExtendedUser[]>(prefix + ` WHERE ` + conditionals.join(' AND ') + postfix)
      data = users.map((user) => {
        if (user.name !== String(user.id)) return { ...user, name: user.name }
        const member = members.find(m => m.userId === user[session.platform])
        return { ...user, name: member.nick || member.name }
      })
    }

    if (typeof value === 'function') {
      data.forEach(user => user._value = value(user))
      const filter: (user: ExtendedUser) => boolean = typeof threshold !== 'number' ? () => true
        : reverse ? user => user._value < threshold : user => user._value > threshold
      const sorter: (a: ExtendedUser, b: ExtendedUser) => number = reverse
        ? ({ _value: a }, { _value: b }) => a < b ? -1 : a > b ? 1 : 0
        : ({ _value: a }, { _value: b }) => a < b ? 1 : a > b ? -1 : 0
      data = data.filter(filter).sort(sorter).slice(0, length)
    }

    const formatter = typeof format === 'function' ? format : (user: ExtendedUser) => user._value + format
    const output = data.map((user, index) => `${index + 1}. ${user.name}：${formatter(user)}`)
    output.unshift(options.global ? `全服${name}排行为：` : `本群${name}排行为：`)
    return output.join('\n')
  }

  export function apply(ctx: Context) {
    ctx.command('adventure/rank [type]', '显示排行')
      .useRank()
      .action(async ({ session, options }, type) => {
        if (!type) {
          const output = Object.keys(ranks).sort().map((key) => {
            return `${paramCase(key)}: ${ranks[key].names[0]}`
          })
          output.unshift('排行项目有：')
          if (session.subtype !== 'group') {
            output.push('使用“rank achv -g”或“全服成就排行”以查看全服排行。')
          } else {
            output.push('使用“rank achv”或“成就排行”以查看特定排行，使用“rank achv -g”或“全服成就排行”以查看全服排行。')
          }
          return output.join('\n')
        }

        const rank = ranks[camelCase(type)]
        if (!rank) return '无法找到对应的排行。'
        return Rank.show(rank, session, options)
      })

    ctx.on('tokenize', (message, session) => {
      if (session.$reply || session.$prefix) return
      const capture = /^(全服|本群)?(.+)(全服|本群)?排[名行]榜?$/.exec(message)
      if (!capture) return
      const global = capture[1] === '全服' || capture[3] === '全服'
      const result = ctx.bail(session, 'adventure/rank', capture[2])
      if (!result) return
      const [name, arg0] = result
      return { name, args: [arg0], options: { global, length: global ? 20 : 10 } }
    })

    ctx.on('adventure/rank', (name) => {
      return rankMap[name] && ['rank', rankMap[name]]
    })
  }
}

export default Rank
