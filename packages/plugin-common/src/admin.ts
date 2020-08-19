import { isInteger, difference, Observed, paramCase, observe, Time, enumKeys } from 'koishi-utils'
import { Context, Session, getTargetId, User, Group } from 'koishi-core'

type ActionCallback<T extends {}, K extends keyof T> =
  (this: Context, session: Session<'authority'>, target: Observed<Pick<T, K>>, ...args: string[]) => Promise<void | string>

export interface ActionItem<T extends {}> {
  callback: ActionCallback<T, keyof T>
  fields: (keyof T)[]
}

export class Action<T extends {}> {
  commands: Record<string, ActionItem<T>> = {}

  add<K extends keyof T = never>(name: string, callback: ActionCallback<T, K>, fields?: K[]) {
    this.commands[paramCase(name)] = { callback, fields }
  }
}

export const UserAction = new Action<User>()
export const GroupAction = new Action<Group>()

UserAction.add('setAuth', async (session, user, value) => {
  const authority = Number(value)
  if (!isInteger(authority) || authority < 0) return '参数错误。'
  if (authority >= session.$user.authority) return '权限不足。'
  if (authority === user.authority) {
    return '用户权限未改动。'
  } else {
    user.authority = authority
    await user._update()
    return '用户权限已修改。'
  }
}, ['authority'])

UserAction.add('setFlag', async (session, user, ...flags) => {
  const userFlags = enumKeys(User.Flag)
  if (!flags.length) return `可用的标记有 ${userFlags.join(', ')}。`
  const notFound = difference(flags, userFlags)
  if (notFound.length) return `未找到标记 ${notFound.join(', ')}。`
  for (const name of flags) {
    user.flag |= User.Flag[name]
  }
  await user._update()
  return '用户信息已修改。'
}, ['flag'])

UserAction.add('unsetFlag', async (session, user, ...flags) => {
  const userFlags = enumKeys(User.Flag)
  if (!flags.length) return `可用的标记有 ${userFlags.join(', ')}。`
  const notFound = difference(flags, userFlags)
  if (notFound.length) return `未找到标记 ${notFound.join(', ')}。`
  for (const name of flags) {
    user.flag &= ~User.Flag[name]
  }
  await user._update()
  return '用户信息已修改。'
}, ['flag'])

UserAction.add('setUsage', async (session, user, name, _count) => {
  const count = +_count
  if (!isInteger(count) || count < 0) return '参数错误。'
  user.usage[name] = count
  await user._update()
  return '用户信息已修改。'
}, ['usage'])

UserAction.add('clearUsage', async (session, user, ...commands) => {
  if (commands.length) {
    for (const command of commands) {
      delete user.usage[command]
    }
  } else {
    user.usage = {}
  }
  await user._update()
  return '用户信息已修改。'
}, ['usage'])

UserAction.add('setTimer', async (session, user, name, offset) => {
  if (!name || !offset) return '参数不足。'
  const timestamp = Time.parseTime(offset)
  if (!timestamp) return '请输入合法的时间。'
  user.timers[name] = Date.now() + timestamp
  await user._update()
  return '用户信息已修改。'
}, ['timers'])

UserAction.add('clearTimer', async (session, user, ...commands) => {
  if (commands.length) {
    for (const command of commands) {
      delete user.timers[command]
    }
  } else {
    user.timers = {}
  }
  await user._update()
  return '用户信息已修改。'
}, ['timers'])

GroupAction.add('setFlag', async (session, group, ...flags) => {
  const groupFlags = enumKeys(Group.Flag)
  if (!flags.length) return `可用的标记有 ${groupFlags.join(', ')}。`
  const notFound = difference(flags, groupFlags)
  if (notFound.length) return `未找到标记 ${notFound.join(', ')}。`
  for (const name of flags) {
    group.flag |= Group.Flag[name]
  }
  await group._update()
  return '群信息已修改。'
}, ['flag'])

GroupAction.add('unsetFlag', async (session, group, ...flags) => {
  const groupFlags = enumKeys(Group.Flag)
  if (!flags.length) return `可用的标记有 ${groupFlags.join(', ')}。`
  const notFound = difference(flags, groupFlags)
  if (notFound.length) return `未找到标记 ${notFound.join(', ')}。`
  for (const name of flags) {
    group.flag &= ~Group.Flag[name]
  }
  await group._update()
  return '群信息已修改。'
}, ['flag'])

GroupAction.add('setAssignee', async (session, group, _assignee) => {
  const assignee = _assignee ? +_assignee : session.selfId
  if (!isInteger(assignee) || assignee < 0) return '参数错误。'
  group.assignee = assignee
  await group._update()
  return '群信息已修改。'
}, ['assignee'])

export function apply(ctx: Context) {
  ctx.command('admin <action> [...args]', '管理用户', { authority: 4 })
    .userFields(['authority'])
    .before(session => !session.$app.database)
    .option('user', '-u [user]  指定目标用户')
    .option('group', '-g [group]  指定目标群')
    .option('thisGroup', '-G, --this-group  指定目标群为本群')
    .action(async ({ session, options }, name, ...args) => {
      const isGroup = 'group' in options || 'thisGroup' in options
      if ('user' in options && isGroup) return '不能同时目标为指定用户和群。'

      const actionMap = isGroup ? GroupAction.commands : UserAction.commands
      const actionList = Object.keys(actionMap).map(paramCase).join(', ')
      if (!name) return `当前的可用指令有：${actionList}。`

      const action = actionMap[paramCase(name)]
      if (!action) return `指令未找到。当前的可用指令有：${actionList}。`

      if (isGroup) {
        const fields = action.fields ? action.fields.slice() as Group.Field[] : Group.fields
        let group: Group.Observed
        if (options.thisGroup) {
          group = await session.$observeGroup(fields)
        } else if (isInteger(options.group) && options.group > 0) {
          const data = await ctx.database.getGroup(options.group, fields)
          if (!data) return '未找到指定的群。'
          group = observe(data, diff => ctx.database.setGroup(options.group, diff), `group ${options.group}`)
        }
        return (action as ActionItem<Group>).callback.call(ctx, session, group, ...args)
      } else {
        const fields = action.fields ? action.fields.slice() as User.Field[] : User.fields
        if (!fields.includes('authority')) fields.push('authority')
        let user: User.Observed
        if (options.user) {
          const qq = getTargetId(options.user)
          if (!qq) return '未指定目标。'
          const data = await ctx.database.getUser(qq, -1, fields)
          if (!data) return '未找到指定的用户。'
          if (qq === session.userId) {
            user = await session.$observeUser(fields)
          } else if (session.$user.authority <= data.authority) {
            return '权限不足。'
          } else {
            user = observe(data, diff => ctx.database.setUser(qq, diff), `user ${qq}`)
          }
        } else {
          user = await session.$observeUser(fields)
        }
        return (action as ActionItem<User>).callback.call(ctx, session, user, ...args)
      }
    })
}
