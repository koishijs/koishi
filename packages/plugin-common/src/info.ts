import { Context, UserField, UserData, getTargetId, Meta } from 'koishi-core'

type UserInfoCallback <K extends UserField = UserField> = (user: Pick<UserData, K>) => string

const infoFields = new Set<UserField>(['authority'])
const infoCallbacks: UserInfoCallback[] = []

export function registerUserInfo <K extends UserField> (callback: UserInfoCallback<K>, fields: Iterable<K> = []) {
  infoCallbacks.push(callback)
  for (const field of fields) {
    infoFields.add(field)
  }
}

export interface InfoOptions {
  getUserName? (user: UserData, meta: Meta<'message'>): string
}

const defaultConfig: InfoOptions = {
  getUserName (user, meta) {
    if (meta.userId === user.id && meta.sender) {
      return meta.sender.card || meta.sender.nickname
    }
  },
}

export default function apply (ctx: Context, config: InfoOptions = {}) {
  config = { ...defaultConfig, ...config }

  ctx.command('info', '查看用户信息', { authority: 0 })
    .alias('i')
    .shortcut('我的信息')
    .option('-u, --user [target]', '指定目标', { authority: 3 })
    .action(async ({ meta, options }) => {
      let user: UserData
      const output = []
      if (options.user) {
        const id = getTargetId(options.user)
        if (!id) return meta.$send('未找到用户。')
        user = await ctx.database.getUser(id, -1, Array.from(infoFields))
        if (!user) return meta.$send('未找到用户。')
        const name = config.getUserName(user, meta)
        if (!name) {
          output.push(`${id} 的权限为 ${user.authority} 级。`)
        } else {
          output.push(`${name} (${id}) 的权限为 ${user.authority} 级。`)
        }
      } else {
        user = await ctx.database.getUser(meta.userId, Array.from(infoFields))
        output.push(`${config.getUserName(user, meta) || meta.userId}，您的权限为 ${user.authority} 级。`)
      }

      for (const callback of infoCallbacks) {
        const result = callback(user)
        if (result) output.push(result)
      }
      return meta.$send(output.join('\n'))
    })
}
