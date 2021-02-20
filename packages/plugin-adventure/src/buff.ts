import { Context, Command, checkTimer, checkUsage } from 'koishi-core'
import { Time } from 'koishi-utils'
import { Adventurer, Show } from './utils'

declare module 'koishi-core/dist/command' {
  interface Command<U, G, A, O> {
    checkTimer(name: string): Command<U | 'timers', G, A, O>
  }
}

Command.prototype.checkTimer = function (this: Command, name) {
  return this.userFields(['timers', 'usage']).check(({ session }) => {
    const user = session.user
    if (!checkTimer(name, user)) return
    const buff = Buff.timers[name]
    if (buff && !checkUsage(name + 'Hint', user, 1)) {
      const rest = user.timers[name] - Date.now()
      return `您当前处于「${buff[0]}」状态，无法调用本功能，剩余 ${Time.formatTime(rest)}。`
    }
    return ''
  })
}

namespace Buff {
  type Callback<K extends Adventurer.Field = never> = (user: Pick<Adventurer, K>) => void | string

  interface BuffInfo<K extends Adventurer.Field = never> {
    order: number
    callback: Callback<K>
  }

  export const fields = new Set<Adventurer.Field>()
  const buffList: BuffInfo[] = []

  export function define<K extends Adventurer.Field>(callback: Callback<K>, fields: Iterable<K> = [], order = 0) {
    const index = buffList.findIndex(a => a.order > order)
    if (index >= 0) {
      buffList.splice(index, 0, { order, callback })
    } else {
      buffList.push({ order, callback })
    }
    for (const field of fields) {
      Buff.fields.add(field)
    }
  }

  export const timers: Record<string, [string, string]> = {}
  export function timer(key: string, name: string, desc: string) {
    timers[key] = [name, desc]
    Show.redirect(name, 'buff')
  }

  timer('$healing', '愈疗加护', '一段时间内免疫状态「无法使用物品」。')
  timer('$drunk', '醉迷恍惚', '一段时间内进行剧情选择时改为随机选择。')
  timer('$mellow', '至醇佳酿', '一段时间内幸运值提高 10 点。')
  timer('$dirt', '生死流转', '一段时间内新获得的状态持续时间减半。')
  timer('$reverseLucky', '幸运反转', '一段时间内幸运值变为原本值的相反数。')
  timer('$lottery', '无法抽卡', '一段时间内无法调用抽卡功能。')
  timer('$system', '无法交互', '一段时间内无法调用具有交互功能的指令。')
  timer('$game', '无法进行游戏', '一段时间内无法调用游戏功能。')
  timer('$use', '无法使用物品', '一段时间内无法调用使用物品指令。')
  timer('$shop', '无法使用商店', '一段时间内无法调用商店交互指令。')
  timer('$luckyBonus', '幸运值提升', '一段时间内幸运值提高 5 点。')

  export function clearTimers(user: Adventurer) {
    const count = countTimers(user)
    Object.keys(timers).forEach(name => delete user.timers[name])
    user.drunkAchv += count
  }

  export function countTimers(user: Pick<Adventurer, 'timers'>) {
    let total = 0
    const now = Date.now()
    Object.keys(timers).forEach(name => total += +(now < user.timers[name]))
    return total
  }

  define((user) => {
    const now = Date.now()
    const output: string[] = []
    for (const name in timers) {
      const due = user.timers[name]
      if (now < due) {
        output.push(`${timers[name][0]}：剩余 ${Time.formatTime(due - now)}`)
      }
    }
    return output.join('\n')
  }, ['timers'])

  export const flags = {} as Record<string, number>

  define((user) => {
    const hints: string[] = []
    for (const name in flags) {
      if ((user.flag & flags[name]) === flags[name]) {
        hints.push(name)
      }
    }
    if (hints.length) return `触发的线索：${hints.join('，')}`
  }, ['flag'])

  export function apply(ctx: Context) {
    ctx.command('adventure/buff [name]', '查看当前状态', { maxUsage: 100, usageName: 'show' })
      .userFields(['name'])
      .userFields(fields)
      .shortcut('我的状态')
      .shortcut('查看状态')
      .action(async ({ session }, name) => {
        if (name) {
          const entry = Object.entries(timers).find(([, value]) => name === value[0])
          if (!entry) return `未找到状态「${name}」。`
          const output = [`状态「${name}」`, entry[1][1]]
          const now = Date.now(), due = session.user.timers[entry[0]]
          if (now < due) output.push(`剩余时间：${Time.formatTime(due - now)}。`)
          return output.join('\n')
        }

        const output = [session.$username]
        for (const { callback } of buffList) {
          const result = callback(session.user)
          if (result) output.push(result)
        }

        output[0] += output.length > 1 ? '，你当前的可见状态列表为：' : '，你当前没有可见状态。'
        return output.join('\n')
      })
  }
}

export default Buff
