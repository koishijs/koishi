import { Context, User, isInteger } from 'koishi-core'
import { Adventurer, Show } from './utils'
import Achievement from './achv'
import Affinity from './affinity'
import Buff from './buff'
import Event from './event'
import Item from './item'
import Luck from './luck'
import Phase from './phase'
import Profile from './profile'
import Rank from './rank'

export { Achievement, Affinity, Buff, Event, Item, Luck, Phase, Profile, Rank }

export * from './utils'

declare module 'koishi-core' {
  interface App {
    adventure: Config
  }

  namespace Plugin {
    interface Packages {
      'koishi-plugin-adventure': typeof import('.')
    }
  }
}

export interface Config extends Item.Config {}

const defaultConfig: Config = {
  createBuyer: () => name => Item.data[name].bid,
  createSeller: () => name => Item.data[name].value,
}

const leadingOrder = ['首杀', '第二杀', '第三杀', '第四杀', '第五杀']

export const name = 'adventure'

export function apply(ctx: Context, config?: Config) {
  ctx.app.adventure = {
    ...defaultConfig,
    ...config,
  }

  ctx.command('adventure', '冒险系统').alias('adv')

  ctx.plugin(Achievement)
  ctx.plugin(Affinity)
  ctx.plugin(Buff)
  ctx.plugin(Item)
  ctx.plugin(Luck)
  ctx.plugin(Phase)
  ctx.plugin(Profile)
  ctx.plugin(Rank)
  ctx.plugin(Show)

  ctx.command('user.add-item', '添加物品', { authority: 4 })
    .option('passive', '-p 不触发效果')
    .userFields<Adventurer.Field>(({ options }, fields) => {
      if (options.passive) {
        return fields.add('warehouse')
      }
      for (const field of Adventurer.fields) {
        fields.add(field)
      }
    })
    .adminUser(({ target, options, session }, item, count = '1') => {
      if (!Item.data[item]) return `未找到物品“${item}”。`
      const nCount = Number(count)
      if (!isInteger(nCount) || nCount <= 0) return '参数错误。'
      if (!options.passive) {
        return Event.gain({ [item]: nCount })(session).replace(/\$s/g, session.username)
      }
      const currentCount = target.warehouse[item] || 0
      target.warehouse[item] = currentCount + nCount
    })

  ctx.command('user.remove-item', '删除物品', { authority: 4 })
    .userFields(['warehouse'])
    .adminUser(({ target }, item, count) => {
      if (!Item.data[item]) return `未找到物品“${item}”。`
      const { warehouse } = target
      if (!count) {
        delete warehouse[item]
      } else {
        const currentCount = warehouse[item] || 0
        const nCount = Number(count)
        if (!isInteger(nCount) || nCount <= 0 || nCount > currentCount) return '参数错误。'
        warehouse[item] = currentCount - nCount
      }
    })

  ctx.command('user.set-item', '设置物品数量', { authority: 4 })
    .userFields(['warehouse'])
    .adminUser(({ target }, item, count) => {
      if (!Item.data[item]) return `未找到物品“${item}”。`
      const nCount = Number(count)
      if (!isInteger(nCount) || nCount < 0) return '参数错误。'
      target.warehouse[item] = nCount
    })

  ctx.command('user.phase <value>', '设置剧情阶段', { authority: 4 })
    .userFields(['progress'])
    .adminUser(({ target }, value) => {
      target.progress = value
    })

  ctx.command('user.money <value>', '设置余额', { authority: 4 })
    .userFields(['money'])
    .adminUser(({ target }, value) => {
      const money = +value
      if (money <= 0) return '参数错误。'
      target.money = money
    })

  ctx.command('user.luck <value>', '设置幸运值', { authority: 4 })
    .userFields(['luck'])
    .adminUser(({ target }, value) => {
      const luck = +value
      if (!isInteger(luck) || luck < -Luck.MAX_LUCKY || luck > Luck.MAX_LUCKY) return '参数错误。'
      target.luck = luck
    })

  const achvReward = [1000, 500, 200]
  ctx.on('adventure/achieve', ({ app, user, username }, achv) => {
    if (user.flag & User.Flag.noLeading) return
    const { count, name } = achv
    const reward = achvReward[count]
    if (reward) {
      app.broadcast(`恭喜 ${username} 获得了成就「${name}」的全服${leadingOrder[count]}，将获得 ${reward}￥ 的奖励！`).catch()
      user.money += reward
      user.wealth += reward
    }
    achv.count += 1
  })

  const endingReward = [300, 200, 100]
  ctx.on('adventure/ending', ({ app, user, username }, id) => {
    if (user.flag & User.Flag.noLeading) return
    const set = Phase.endingCount[id] ||= new Set()
    const count = set.size, reward = endingReward[count]
    if (reward && set.add(user.id).size > count) {
      app.broadcast(`恭喜 ${username} 达成了结局「${Phase.endingMap[id]}」的全服${leadingOrder[count]}，将获得 ${reward}￥ 的奖励！`).catch()
      user.money += reward
      user.wealth += reward
    }
  })
}
