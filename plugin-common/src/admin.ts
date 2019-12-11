import { Context, User, userFlags, UserFlag, Meta, UserField, getTargetId, CommandConfig, GroupField, UserData, GroupData } from 'koishi-core'
import { isInteger, difference, Observed, paramCase } from 'koishi-utils'

type ActionCallback <T extends {}, K extends keyof T> =
  (this: Context, meta: Meta, target: Observed<Pick<T, K>>, ...args: string[]) => Promise<any>

export interface UserAction {
  callback: ActionCallback<UserData, UserField>
  fields: UserField[]
}

export interface GroupAction {
  callback: ActionCallback<GroupData, GroupField>
  fields: GroupField[]
}

const userActionMap: Record<string, UserAction> = {}
const groupActionMap: Record<string, GroupAction> = {}

export function registerUserAction <K extends UserField> (name: string, callback: ActionCallback<UserData, K>, fields: K[] = []) {
  userActionMap[paramCase(name)] = { callback, fields }
}

export function registerGroupAction <K extends GroupField> (name: string, callback: ActionCallback<GroupData, K>, fields: K[] = []) {
  groupActionMap[paramCase(name)] = { callback, fields }
}

registerUserAction('setAuth', async (meta, user, value) => {
  const authority = Number(value)
  if (!isInteger(authority) || authority < 0) return meta.$send('参数错误。')
  if (authority >= meta.$user.authority) return meta.$send('权限不足。')
  if (authority === user.authority) {
    return meta.$send('用户权限未改动。')
  } else {
    user.authority = authority
    await user._update()
    return meta.$send('用户权限已修改。')
  }
})

registerUserAction('setFlag', async (meta, user, ...flags) => {
  if (!flags.length) return meta.$send(`可用的标记有 ${userFlags.join(', ')}。`)
  const notFound = difference(flags, userFlags)
  if (notFound.length) return meta.$send(`未找到标记 ${notFound.join(', ')}。`)
  for (const name of flags) {
    user.flag |= UserFlag[name]
  }
  await user._update()
  return meta.$send('用户信息已修改。')
})

registerUserAction('unsetFlag', async (meta, user, ...flags) => {
  if (!flags.length) return meta.$send(`可用的 flag 有：${userFlags.join(', ')}。`)
  const notFound = difference(flags, userFlags)
  if (notFound.length) return meta.$send(`未找到标记 ${notFound.join(', ')}。`)
  for (const name of flags) {
    user.flag &= ~UserFlag[name]
  }
  await user._update()
  return meta.$send('用户信息已修改。')
})

registerUserAction('clearUsage', async (meta, user, ...commands) => {
  if (commands.length) {
    for (const command of commands) {
      delete user.usage[command]
    }
  } else {
    user.usage = {}
  }
  await user._update()
  return meta.$send('用户信息已修改。')
})

registerUserAction('showUsage', async (meta, user, ...commands) => {
  const { usage } = user
  if (!commands.length) commands = Object.keys(usage)
  if (!commands.length) return meta.$send('用户今日没有调用过指令。')
  return meta.$send([
    '用户今日各指令的调用次数为：',
    ...commands.sort().map(name => `${name}：${usage[name] ? usage[name].count : 0} 次`),
  ].join('\n'))
})

export default function apply (ctx: Context, options: CommandConfig) {
  const userActions = Object.keys(userActionMap).map(paramCase).join(', ')
  const groupActions = Object.keys(groupActionMap).map(paramCase).join(', ')

  ctx.command('admin <action> [...args]', '管理用户', { authority: 4, ...options })
    .option('-u, --user [user]', '指定目标用户')
    .option('-g, --group [group]', '指定目标群')
    .option('-G, --this-group', '指定目标群为本群')
    .action(async ({ meta, options }, name: string, ...args: string[]) => {
      const isGroup = 'g' in options || 'G' in options
      if ('user' in options && isGroup) {
        return meta.$send('不能同时目标为指定用户和群。')
      }
      const actionList = isGroup ? groupActions : userActions
      const actionMap = isGroup ? groupActionMap : userActionMap
      if (!name) {
        return meta.$send(`当前的可用指令有：${actionList}。`)
      }
      const action = actionMap[paramCase(name)]
      if (!action) return meta.$send(`指令未找到。当前的可用指令有：${actionList}。`)

      if (isGroup) {
        let group: Observed<GroupData>
        if (options.thisGroup) {
          group = await ctx.database.observeGroup(meta.$group)
        } else if (typeof options.group === 'number') {
          group = await ctx.database.observeGroup(options.group)
        }
        if (!group) return meta.$send('未找到指定的群。')
        return action.callback.call(ctx, meta, group, ...args)
      } else {
        const fields = action.fields.slice() as UserField[]
        if (!fields.includes('authority')) fields.push('authority')
        let user: User
        if (options.user) {
          const qq = getTargetId(options.user)
          if (!qq) return meta.$send('未指定目标。')
          user = await ctx.database.observeUser(qq, -1, fields)
          if (!user) return meta.$send('未找到用户。')
          if (qq !== meta.$user.id && meta.$user.authority <= user.authority) return meta.$send('权限不足。')
        } else {
          user = await ctx.database.observeUser(meta.$user, 0, fields)
        }
        return action.callback.call(ctx, meta, user, ...args)
      }
    })
}
