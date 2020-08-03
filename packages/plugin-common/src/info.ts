import { Context, User, getTargetId } from 'koishi-core'

type UserInfoCallback <K extends User.Field = User.Field> = (user: Pick<User, K>) => string

interface Info <K extends User.Field = User.Field> {
  order: number
  callback: (user: Pick<User, K>) => string
}

const infoFields = new Set<User.Field>(['authority'])
const infoList: Info[] = []

export function registerUserInfo <K extends User.Field> (callback: UserInfoCallback<K>, fields: Iterable<K> = [], order = 0) {
  const index = infoList.findIndex(a => a.order > order)
  if (index >= 0) {
    infoList.splice(index, 0, { order, callback })
  } else {
    infoList.push({ order, callback })
  }
  for (const field of fields) {
    infoFields.add(field)
  }
}

export function apply (ctx: Context) {
  ctx.command('info', '查看用户信息', { authority: 0 })
    .alias('profile')
    .shortcut('我的信息')
    .userFields(['name'])
    .before(session => !session.$app.database)
    .option('-u, --user [target]', '指定目标', { authority: 3 })
    .action(async ({ session, options }) => {
      let user: User
      const output = []
      if (options.user) {
        const id = getTargetId(options.user)
        if (!id) return session.$send('未找到用户。')
        user = await ctx.database.getUser(id, -1, Array.from(infoFields))
        if (!user) return session.$send('未找到用户。')
        if (+user.name === id) {
          output.push(`${id} 的权限为 ${user.authority} 级。`)
        } else {
          output.push(`${user.name} (${id}) 的权限为 ${user.authority} 级。`)
        }
      } else {
        user = await ctx.database.getUser(session.userId, Array.from(infoFields))
        output.push(`${session.$username}，您的权限为 ${user.authority} 级。`)
      }

      for (const { callback } of infoList) {
        const result = callback(user)
        if (result) output.push(result)
      }
      return session.$send(output.join('\n'))
    })
}
