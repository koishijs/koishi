import { Context, UserField, UserData, getTargetId } from 'koishi-core'

type UserInfoCallback <K extends UserField = UserField> = (user: Pick<UserData, K>) => string

interface Info <K extends UserField = UserField> {
  order: number
  callback: (user: Pick<UserData, K>) => string
}

const infoFields = new Set<UserField>(['authority'])
const infoList: Info[] = []

export function registerUserInfo <K extends UserField> (callback: UserInfoCallback<K>, fields: Iterable<K> = [], order = 0) {
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

export default function apply (ctx: Context) {
  ctx.command('info', '查看用户信息', { authority: 0 })
    .shortcut('我的信息')
    .userFields(['name'])
    .option('-u, --user [target]', '指定目标', { authority: 3 })
    .action(async ({ meta, options }) => {
      let user: UserData
      const output = []
      if (options.user) {
        const id = getTargetId(options.user)
        if (!id) return meta.$send('未找到用户。')
        user = await ctx.database.getUser(id, -1, Array.from(infoFields))
        if (!user) return meta.$send('未找到用户。')
        if (+user.name === id) {
          output.push(`${id} 的权限为 ${user.authority} 级。`)
        } else {
          output.push(`${user.name} (${id}) 的权限为 ${user.authority} 级。`)
        }
      } else {
        user = await ctx.database.getUser(meta.userId, Array.from(infoFields))
        output.push(`${meta.$nickname}，您的权限为 ${user.authority} 级。`)
      }

      for (const { callback } of infoList) {
        const result = callback(user)
        if (result) output.push(result)
      }
      return meta.$send(output.join('\n'))
    })
}
