import { User, checkTimer, Logger } from 'koishi'
import { Adventurer } from './utils'
import Buff from './buff'
import Item from './item'
import Luck from './luck'
import Phase from './phase'

const logger = new Logger('cosmos').extend('event')

type Event<T = any> = (session: Adventurer.Session, state?: T) => string | void

namespace Event {
  export type Visible<T = any> = (session: Adventurer.Session, state?: T) => string

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

  export const sell = (itemMap: Readonly<Record<string, number>>): Visible => ({ user, app }) => {
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

  export const buy = (itemMap: Readonly<Record<string, number>>): Visible => ({ user, app }) => {
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

  export const updateTimer = <T>(name: string, hours: Adventurer.Update<number, T>, reason = ''): Event<T> => (session, state) => {
    const { app, user } = session
    const result = app.bail('adventure/before-timer', name, reason, session)
    if (result) return result

    // 如果是新状态则清除调用提示
    if (!checkTimer(name, user)) {
      delete user.usage[name + 'Hint']
    }

    // 生死流转仅对显式状态生效
    const scale = reason && checkTimer('$dirt', user) ? 1800000 : 3600000
    checkTimer(name, user, Adventurer.getValue(hours, user, state) * scale)
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

  // Money

  export const loseMoney = <T>(value: Adventurer.Update<number, T>): Visible<T> => ({ user }, state) => {
    const loss = Math.min(Adventurer.getValue(value, user, state), user.money)
    user.money -= loss
    return `$s 损失了 ${+loss.toFixed(1)}￥！`
  }

  export const gainMoney = <T>(value: Adventurer.Update<number, T>): Visible<T> => ({ user }, state) => {
    const gain = Math.min(Adventurer.getValue(value, user, state), user.money)
    user.money += gain
    user.wealth += gain
    return `$s 获得了 ${+gain.toFixed(1)}￥！`
  }

  // Item

  function toItemMap(items: Item.Pack) {
    if (!Array.isArray(items)) return items
    const map: Record<string, number> = {}
    for (const name of items) {
      map[name] = (map[name] || 0) + 1
    }
    return map
  }

  export const gain = <T>(items: Adventurer.Update<Item.Pack, T>, reason = '$s $n获得了$i$r！'): Visible<T> => (session, state) => {
    const output: string[] = []
    const itemMap = toItemMap(Adventurer.getValue(items, session.user, state))
    for (const name in itemMap) {
      const isOld = name in session.user.warehouse
      const { rarity, description } = Item.data[name]
      session._item = name
      const count = itemMap[name]
      const result = Item.gain(session, name, count)
      output.push(reason
        .replace('$n', isOld ? '' : '首次')
        .replace('$i', session._item + (count > 1 ? '×' + count : ''))
        .replace('$r', `（${rarity}）`))
      if (!session._skipAll) output.push(description)
      if (result) output.push(result)
      session._gains.add(name)
    }
    session.app.emit('adventure/gain', itemMap, session, output)
    return output.join('\n')
  }

  const rarities = ['N', 'R', 'SR', 'SSR', 'EX'] as Item.Rarity[]

  export const gainRandom = <T>(count: Adventurer.Update<number, T>, exclude: readonly string[] = []): Visible<T> => (session, state) => {
    const _count = Adventurer.getValue(count, session.user, state)
    const itemMap: Record<string, number> = {}
    const gainList: string[] = []

    const data = {} as Record<Item.Rarity, string[]>
    for (const rarity of rarities) {
      data[rarity] = Item.data[rarity].filter(({ name, beforePick }) => {
        return !exclude.includes(name) && !beforePick?.(session)
      }).map(({ name }) => name)
    }

    const output: string[] = []
    for (let i = 0; i < _count; i += 1) {
      const rarity = Luck.use(session.user).weightedPick(Luck.probabilities)
      const index = Math.floor(Math.random() * data[rarity].length)
      const [item] = data[rarity].splice(index, 1)
      if (!data[rarity].length) delete data[rarity]
      session._item = item
      const result = Item.gain(session, item)
      if (result) output.push(result)
      session._gains.add(item)
      itemMap[item] = (itemMap[item] || 0) + 1
      gainList.push(session._item)
    }

    output.unshift(`$s 获得了 ${_count} 件随机物品：${Item.format(gainList)}！`)
    session.app.emit('adventure/gain', itemMap, session, output)
    return output.join('\n')
  }

  export const lose = <T>(items: Adventurer.Update<Item.Pack, T>, reason = '$s 失去了$i！'): Visible<T> => (session, state) => {
    const itemMap = toItemMap(Adventurer.getValue(items, session.user, state))
    const output = reason
      ? [reason.replace('$i', () => Item.format(Array.isArray(items) ? items : itemMap))]
      : []
    for (const name in itemMap) {
      const result = Item.lose(session, name)
      if (result) output.push(result)
    }
    session.app.emit('adventure/lose', itemMap, session, output)
    return output.join('\n')
  }

  export const loseRandom = <T>(count: Adventurer.Update<number, T>, exclude: readonly string[] = []): Visible<T> => (session, state) => {
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
    length = Math.min(length, Adventurer.getValue(count, session.user, state))

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
    session.app.emit('adventure/lose', toItemMap(lostList), session, output)
    return output.join('\n')
  }

  export const loseRecent = <T>(count: Adventurer.Update<number, T>): Visible<T> => (session, state) => {
    const _count = Adventurer.getValue(count, session.user, state)
    const recent = session.user.recent.slice(0, _count)
    if (!recent.length) return
    const output = [`$s 失去了最后获得的 ${recent.length} 件物品：${Item.format(recent)}！`]
    for (const name of recent) {
      const result = Item.lose(session, name)
      if (result) output.push(result)
    }
    session.app.emit('adventure/lose', toItemMap(recent), session, output)
    session.user.recent = []
    return output.join('\n')
  }
}

export default Event
