import { Context, User } from 'koishi'

type ProfileCallback<K extends User.Field = never> = (user: Pick<User, K>) => string

interface Profile<K extends User.Field = never> {
  order: number
  callback: ProfileCallback<K>
}

namespace Profile {
  const data: Profile[] = []
  export const fields = new Set<User.Field>(['authority'])

  export function add<K extends User.Field>(callback: ProfileCallback<K>, fields: Iterable<K> = [], order = 0) {
    const index = data.findIndex(a => a.order > order)
    if (index >= 0) {
      data.splice(index, 0, { order, callback })
    } else {
      data.push({ order, callback })
    }
    for (const field of fields) {
      Profile.fields.add(field)
    }
  }

  export function apply(ctx: Context) {
    ctx.command('adv/profile', '用户信息', { maxUsage: 100, usageName: 'show' })
      .alias('info')
      .shortcut('我的信息')
      .shortcut('查看信息')
      .userFields(['name', 'timers', 'authority'])
      .userFields(fields)
      .action(async ({ session }) => {
        const output = [`${session.username}，您的权限为 ${session.user.authority} 级。`]
        for (const { callback } of data) {
          const result = callback(session.user)
          if (result) output.push(result)
        }
        return output.join('\n')
      })
  }
}

export default Profile
