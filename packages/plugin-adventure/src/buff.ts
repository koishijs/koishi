import { Context, Command, checkTimer, checkUsage } from 'koishi-core'
import { Time } from 'koishi-utils'
import { Adventurer } from './utils'

declare module 'koishi-core/dist/command' {
  interface Command<U, G, O> {
    checkTimer(name: string): Command<U | 'timers', G, O>
  }
}

Command.prototype.checkTimer = function (this: Command, name) {
  return this.userFields(['timers', 'usage']).before((session) => {
    const user = session.$user
    const blocked = checkTimer(name, user)
    const buff = Buff.timers[name]
    if (blocked && buff && !checkUsage(name + 'Hint', user, 1)) {
      const rest = user.timers[name] - Date.now()
      session.$send(`您当前处于「${buff}」状态，无法调用本功能，剩余 ${Time.formatTime(rest)}。`)
    }
    return blocked
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

  export const timers = {
    $healing: '愈疗加护',
    $majesty: '威严满满',
    $drunk: '醉迷恍惚',
    $dream: '化蝶迷梦',
    $bargain: '福神恩泽',
    $mellow: '至醇佳酿',
    $masu: '神魂涤荡',
    $dirt: '生死流转',
    $reverseLucky: '幸运反转',
    $control: '精神失控',
    $lottery: '无法抽卡',
    $system: '无法交互',
    $game: '无法进行游戏',
    $use: '无法使用物品',
    $shop: '无法使用商店',
    $affinityBonus: '好感度提升',
    $luckyBonus: '幸运值提升',
    $priceBouns: '物品售价提升',
  }

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
        output.push(`${timers[name]}：剩余 ${Time.formatTime(due - now)}`)
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
    ctx.command('adventure/buff', '查看当前状态', { maxUsage: 100, usageName: 'show' })
      .userFields(['name'])
      .userFields(fields)
      .shortcut('我的状态')
      .shortcut('查看状态')
      .action(async ({ session }) => {
        const output: string[] = []

        for (const { callback } of buffList) {
          const result = callback(session.$user)
          if (result) output.push(result)
        }

        if (output.length) {
          output.unshift(`${session.$username}，你当前的可见状态列表为：`)
        } else {
          output.unshift(`${session.$username}，你当前没有可见状态。`)
        }

        return output.join('\n')
      })
  }
}

export default Buff
