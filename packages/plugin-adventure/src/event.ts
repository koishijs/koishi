import { getValue, Shopper, Adventurer } from './utils'
import { User, checkTimer, Session } from 'koishi-core'
import { Logger } from 'koishi-utils'
import Buff from './buff'
import Item from './item'
import Luck from './luck'
import Phase from './phase'

const logger = new Logger('cosmos').extend('event')

type Event<T extends User.Field = Adventurer.Field> = (session: Session<T>) => string | void

namespace Event {
  export type Visible<T extends User.Field = Adventurer.Field> = (session: Session<T>) => string

  export const ending = (id: string): Visible => (session) => {
    const { app, user } = session
    const hasEnding = user.endings[id]
    if (!hasEnding) {
      user.endings[id] = 1
    } else {
      user.endings[id] += 1
    }
    const output = [`$s ${hasEnding ? '' : '首次'}达成了结局「${Phase.endingMap[id]}」！`]
    app.emit('adventure/ending', session, id, output)
    return output.join('\n')
  }

  export const sell = (itemMap: Readonly<Record<string, number>>): Visible<Shopper.Field> => ({ user, app }) => {
    let moneyGained = 0
    const toValue = app.adventure.createSeller(user)
    for (const name in itemMap) {
      const count = itemMap[name]
      const value = toValue(name)
      user.warehouse[name] -= count
      moneyGained += count * value
    }
    user.money += moneyGained
    user.wealth += moneyGained
    logger.debug('%s sell %s', user.id, Object.entries(itemMap).map(([key, value]) => `${key} ${value}`).join(' '))
    return `已售出${Item.format(itemMap)}，获得 ${+moneyGained.toFixed(1)}￥，余额 ${+user.money.toFixed(1)}￥。`
  }

  export const buy = (itemMap: Readonly<Record<string, number>>): Visible<Shopper.Field> => ({ user, app }) => {
    let moneyLost = 0
    const toBid = app.adventure.createBuyer(user)
    for (const name in itemMap) {
      const count = itemMap[name]
      const bid = toBid(name)
      user.gains[name] = (user.gains[name] || 0) + count
      user.warehouse[name] = (user.warehouse[name] || 0) + count
      moneyLost += count * bid
    }
    user.money -= moneyLost
    logger.debug('%s buy %s', user.id, Object.entries(itemMap).map(([key, value]) => `${key} ${value}`).join(' '))
    return `已购入${Item.format(itemMap)}，花费 ${+moneyLost.toFixed(1)}￥，余额 ${+user.money.toFixed(1)}￥。`
  }

  export const combine = (events: Event[]): Event => (session) => {
    let message: string | void
    events.forEach(event => message = event(session) || message)
    return message
  }

  export const updateTimer = (name: string, hours: Adventurer.Infer<number>, reason = ''): Event => ({ user }) => {
    // 替身地藏自动抵消无法交互的效果
    if (name === '$system' && user.warehouse['替身地藏']) {
      user.warehouse['替身地藏'] -= 1
      user.avatarAchv += 1
      return `${reason}\n$s 扔出替身地藏躲过了一劫。\n$s 失去了替身地藏（SP）！`
    }

    // 疗伤加护自动抵消无法使用物品的效果
    if (name === '$use' && checkTimer('$healing', user)) {
      return `${reason}\n河童的秘药瞬间治愈了 $s 手上的伤！`
    }

    // 当死亡时将酒品归零
    if (name === '$system') {
      user.taste = 0
    }

    // 如果是新状态则清除调用提示
    if (!checkTimer(name, user)) {
      delete user.usage[name + 'Hint']
    }

    // 生死流转仅对显式状态生效
    const scale = reason && checkTimer('$dirt', user) ? 1800000 : 3600000
    checkTimer(name, user, getValue(hours, user) * scale)
    return reason
  }

  export const clearTimer = (name: string, reason?: string): Event => ({ user }) => {
    delete user.timers[name]
    return reason
  }

  export const setFlag = (flag: User.Flag): Event => ({ user }) => {
    user.flag |= flag
    const output: string[] = []
    for (const name in Buff.flags) {
      const value = Buff.flags[name]
      if ((value & flag) && (user.flag & value) === value) {
        output.push(`$s 触发了线索「${name}」！`)
      }
    }
    return output.join('\n')
  }

  export const unsetFlag = (flag: User.Flag): Event => ({ user }) => {
    user.flag &= ~flag
  }

  export const updateLuck = (offset: number, reason: string): Event => ({ user }) => {
    user.luck = Luck.restrict(user.luck + offset * Luck.coefficient(user))
    return reason
  }

  export const decreaseLuck = (delta: number, reason: string, preventMessage: string): Event => (session) => {
    if (session.user.warehouse['疵痕之护符']) {
      session.user.warehouse['疵痕之护符'] -= 1
      session.user.avatarAchv += 1
      return preventMessage
    } else {
      return updateLuck(-delta, reason)(session)
    }
  }

  export const loseMoney = (value: Adventurer.Infer<number>): Event => ({ user }) => {
    const loss = Math.min(getValue(value, user), user.money)
    user.money -= loss
    return `$s 损失了 ${+loss.toFixed(1)}￥！`
  }

  export const gain = (...names: string[]): Event => (session) => {
    const output: string[] = []
    for (const name of names) {
      const isOld = name in session.user.warehouse
      const { rarity, description } = Item.data[name]
      session._item = name
      const result = Item.gain(session, name)
      output.push(`$s ${isOld ? '' : '首次'}获得了${session._item}（${rarity}）！`)
      if (!session._skipAll) output.push(description)
      if (result) output.push(result)
    }
    const result = Item.checkOverflow(session, names)
    if (result) output.push(result)
    return output.join('\n')
  }

  export function gainSingle(name: string, reason: string): Event.Visible
  export function gainSingle(name: string, count: Adventurer.Infer<number>): Event.Visible
  export function gainSingle(name: string, arg: string | Adventurer.Infer<number>): Visible {
    return (session) => {
      let output: string
      if (typeof arg === 'string') {
        session._item = name
        const result = Item.gain(session, name)
        output = arg.replace('$i', session._item)
        if (!session._skipAll) output += '\n' + Item.data[name].description
        if (result) output += '\n' + result
      } else {
        const { warehouse, gains } = session.user
        const _count = getValue(arg, session.user)
        const isOld = name in gains
        if (!isOld) {
          warehouse[name] = 0
          gains[name] = 0
        }
        warehouse[name] += _count
        gains[name] += _count
        output = `$s ${isOld ? '' : '首次'}获得了${name}×${_count}！`
        if (!session._skipAll) output += '\n' + Item.data[name].description
      }
      const result = Item.checkOverflow(session, [name])
      if (result) output += '\n' + result
      return output
    }
  }

  export function lose(items: Item.Pack, reason = '$s 失去了$i！'): Visible<Shopper.Field> {
    reason = reason.replace('$i', () => Item.format(items))
    const itemMap = Array.isArray(items)
      ? Object.fromEntries(items.map(arg => [arg, 1]))
      : items
    return (session) => {
      const output = [reason]
      for (const name in itemMap) {
        const result = Item.lose(session, name)
        if (result) output.push(result)
      }
      session.app.emit('adventure/lose', itemMap, session, output)
      return output.join('\n')
    }
  }

  const rarities = ['N', 'R', 'SR', 'SSR', 'EX'] as Item.Rarity[]

  export const gainRandom = (count: Adventurer.Infer<number>, exclude: readonly string[] = []): Event => (session) => {
    const _count = getValue(count, session.user)
    const gainListOriginal: string[] = []
    const gainListFormatted: string[] = []

    const data = {} as Record<Item.Rarity, string[]>
    for (const rarity of rarities) {
      data[rarity] = Item.data[rarity].filter(({ name, condition }) => {
        return !exclude.includes(name) && (!condition || condition(session.user, false))
      }).map(({ name }) => name)
    }

    const output: string[] = []
    for (let i = 0; i < _count; i += 1) {
      const rarity = Luck.use(session.user).weightedPick(Luck.probabilities)
      const index = Math.floor(Math.random() * data[rarity].length)
      const [item] = data[rarity].splice(index, 1)
      session._item = item
      const result = Item.gain(session, item)
      if (result) output.push(result)
      gainListOriginal.push(item)
      gainListFormatted.push(session._item)
    }

    output.unshift(`$s 获得了 ${_count} 件随机物品：${Item.format(gainListFormatted)}！`)
    const result = Item.checkOverflow(session, gainListOriginal)
    if (result) output.push(result)
    return output.join('\n')
  }

  export const loseRandom = (count: Adventurer.Infer<number>, exclude: readonly string[] = []): Event => (session) => {
    const lostList: string[] = []
    let length = 0

    const probabilities = { ...Luck.probabilities }
    const data = {} as Record<Item.Rarity, string[]>
    for (const rarity of rarities.reverse()) {
      data[rarity] = Item.data[rarity]
        .map(({ name }) => name)
        .filter(name => session.user.warehouse[name] && !exclude.includes(name))
      length += data[rarity].length
      if (!data[rarity].length) probabilities[rarity] = 0
    }
    length = Math.min(length, getValue(count, session.user))

    const output: string[] = []
    for (let i = 0; i < length; i += 1) {
      const rarity = Luck.use(session.user).weightedPick(probabilities)
      const index = Math.floor(Math.random() * data[rarity].length)
      const [name] = data[rarity].splice(index, 1)
      if (!data[rarity].length) probabilities[rarity] = 0
      lostList.push(name)
      const result = Item.lose(session, name)
      if (result) output.push(result)
    }
    output.unshift(`$s 失去了 ${length} 件随机物品：${Item.format(lostList)}！`)
    return output.join('\n')
  }

  export const loseRecent = (count: Adventurer.Infer<number>): Event => (session) => {
    const _count = getValue(count, session.user)
    const recent = session.user.recent.slice(0, _count)
    if (!recent.length) return
    const output = [`$s 失去了最后获得的 ${recent.length} 件物品：${Item.format(recent)}！`]
    for (const name of recent) {
      const result = Item.lose(session, name)
      if (result) output.push(result)
    }
    session.user.recent = []
    return output.join('\n')
  }
}

export default Event
