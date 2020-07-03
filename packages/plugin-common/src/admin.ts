import { isInteger, difference, Observed, paramCase, observe, parseTime } from 'koishi-utils'
import {
  Context, Meta, getTargetId,
  User, UserData, userFlags, UserFlag, userFields, UserField,
  Group, GroupData, groupFlags, GroupFlag, groupFields, GroupField,
} from 'koishi-core'

type ActionCallback <T extends {}, K extends keyof T> =
  (this: Context, meta: Meta<'authority'>, target: Observed<Pick<T, K>>, ...args: string[]) => Promise<any>

export interface ActionItem <T extends {}> {
  callback: ActionCallback<T, keyof T>
  fields: (keyof T)[]
}

export class Action <T extends {}> {
  commands: Record<string, ActionItem<T>> = {}

  add <K extends keyof T = never> (name: string, callback: ActionCallback<T, K>, fields?: K[]) {
    this.commands[paramCase(name)] = { callback, fields }
  }
}

export const UserAction = new Action<UserData>()
export const GroupAction = new Action<GroupData>()

UserAction.add('setAuth', async (meta, user, value) => {
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
}, ['authority'])

UserAction.add('setFlag', async (meta, user, ...flags) => {
  if (!flags.length) return meta.$send(`可用的标记有 ${userFlags.join(', ')}。`)
  const notFound = difference(flags, userFlags)
  if (notFound.length) return meta.$send(`未找到标记 ${notFound.join(', ')}。`)
  for (const name of flags) {
    user.flag |= UserFlag[name]
  }
  await user._update()
  return meta.$send('用户信息已修改。')
}, ['flag'])

UserAction.add('unsetFlag', async (meta, user, ...flags) => {
  if (!flags.length) return meta.$send(`可用的标记有 ${userFlags.join(', ')}。`)
  const notFound = difference(flags, userFlags)
  if (notFound.length) return meta.$send(`未找到标记 ${notFound.join(', ')}。`)
  for (const name of flags) {
    user.flag &= ~UserFlag[name]
  }
  await user._update()
  return meta.$send('用户信息已修改。')
}, ['flag'])

UserAction.add('setUsage', async (meta, user, name, _count) => {
  const count = +_count
  if (!isInteger(count) || count < 0) return meta.$send('参数错误。')
  user.usage[name] = count
  await user._update()
  return meta.$send('用户信息已修改。')
}, ['usage'])

UserAction.add('clearUsage', async (meta, user, ...commands) => {
  if (commands.length) {
    for (const command of commands) {
      delete user.usage[command]
    }
  } else {
    user.usage = {}
  }
  await user._update()
  return meta.$send('用户信息已修改。')
}, ['usage'])

UserAction.add('setTimer', async (meta, user, name, offset) => {
  if (!name || !offset) return meta.$send('参数不足。')
  const timestamp = parseTime(offset)
  if (!timestamp) return meta.$send('请输入合法的时间间隔。')
  user.timers[name] = timestamp
  await user._update()
  return meta.$send('用户信息已修改。')
}, ['timers'])

UserAction.add('clearTimer', async (meta, user, ...commands) => {
  if (commands.length) {
    for (const command of commands) {
      delete user.timers[command]
    }
  } else {
    user.timers = {}
  }
  await user._update()
  return meta.$send('用户信息已修改。')
}, ['timers'])

GroupAction.add('setFlag', async (meta, group, ...flags) => {
  if (!flags.length) return meta.$send(`可用的标记有 ${groupFlags.join(', ')}。`)
  const notFound = difference(flags, groupFlags)
  if (notFound.length) return meta.$send(`未找到标记 ${notFound.join(', ')}。`)
  for (const name of flags) {
    group.flag |= GroupFlag[name]
  }
  await group._update()
  return meta.$send('群信息已修改。')
}, ['flag'])

GroupAction.add('unsetFlag', async (meta, group, ...flags) => {
  if (!flags.length) return meta.$send(`可用的标记有 ${groupFlags.join(', ')}。`)
  const notFound = difference(flags, groupFlags)
  if (notFound.length) return meta.$send(`未找到标记 ${notFound.join(', ')}。`)
  for (const name of flags) {
    group.flag &= ~GroupFlag[name]
  }
  await group._update()
  return meta.$send('群信息已修改。')
}, ['flag'])

export default function apply (ctx: Context) {
  ctx.command('admin <action> [...args]', '管理用户', { authority: 4 })
    .userFields(['authority'])
    .option('-u, --user [user]', '指定目标用户')
    .option('-g, --group [group]', '指定目标群')
    .option('-G, --this-group', '指定目标群为本群')
    .action(async ({ meta, options }, name, ...args) => {
      const isGroup = 'g' in options || 'G' in options
      if ('user' in options && isGroup) return meta.$send('不能同时目标为指定用户和群。')

      const actionMap = isGroup ? GroupAction.commands : UserAction.commands
      const actionList = Object.keys(actionMap).map(paramCase).join(', ')
      if (!name) return meta.$send(`当前的可用指令有：${actionList}。`)

      const action = actionMap[paramCase(name)]
      if (!action) return meta.$send(`指令未找到。当前的可用指令有：${actionList}。`)

      if (isGroup) {
        const fields = action.fields ? action.fields.slice() as GroupField[] : groupFields
        let group: Group
        if (options.thisGroup) {
          group = await ctx.observeGroup(meta, fields)
        } else if (isInteger(options.group) && options.group > 0) {
          const data = await ctx.database.getGroup(options.group, fields)
          if (!data) return meta.$send('未找到指定的群。')
          group = observe(data, diff => ctx.database.setGroup(options.group, diff), `group ${options.group}`)
        }
        return action.callback.call(ctx, meta, group, ...args)
      } else {
        const fields = action.fields ? action.fields.slice() as UserField[] : userFields
        if (!fields.includes('authority')) fields.push('authority')
        let user: User
        if (options.user) {
          const qq = getTargetId(options.user)
          if (!qq) return meta.$send('未指定目标。')
          const data = await ctx.database.getUser(qq, -1, fields)
          if (!data) return meta.$send('未找到指定的用户。')
          if (qq === meta.userId) {
            user = await ctx.observeUser(meta, fields)
          } else if (meta.$user.authority <= data.authority) {
            return meta.$send('权限不足。')
          } else {
            user = observe(data, diff => ctx.database.setUser(qq, diff), `user ${qq}`)
          }
        } else {
          user = await ctx.observeUser(meta, fields)
        }
        return action.callback.call(ctx, meta, user, ...args)
      }
    })
}
