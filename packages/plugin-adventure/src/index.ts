import { Command, Context, NextFunction } from 'koishi-core'
import { isInteger } from 'koishi-utils'
import { showMap } from './utils'
import Achievement from './achievement'
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

declare module 'koishi-core/dist/app' {
  interface App {
    adventure: Config
  }
}

export interface Config extends Item.Config {}

const defaultConfig: Config = {
  createBuyer: () => name => Item.data[name].bid,
  createSeller: () => name => Item.data[name].value,
}

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

  ctx.command('adventure/show [name]', '查看图鉴', { maxUsage: 100 })
    .shortcut('查看', { fuzzy: true })
    .userFields(['usage'])
    .userFields((argv, fields) => {
      Command.collect({ ...argv, command: ctx.command('item') }, 'user', fields)
      Command.collect({ ...argv, command: ctx.command('achv') }, 'user', fields)
      Command.collect({ ...argv, command: ctx.command('ed') }, 'user', fields)
    })
    .action((argv, ...names) => {
      const { session, next: _next } = argv
      const target = names.join(' ')
      session.content = `show:${target}`
      const next: NextFunction = (next = _next => _next()) => {
        session.$user.usage.show -= 1
        return _next(() => next(() => session.$send(`未找到图鉴「${target}」。`)))
      }
      if (target in showMap) {
        const [type, content] = showMap[target]
        if (type === 'message') return content
        return ctx.command(content).execute({
          session,
          args: [target],
          options: { pass: true },
          next,
        })
      }
      return next()
    })

  ctx.command('user.add-item', '添加物品', { authority: 4 })
    .userFields(['warehouse'])
    .adminUser(({ target }, item, count = '1') => {
      if (!Item.data[item]) return `未找到物品“${item}”。`
      const currentCount = target.warehouse[item] || 0
      const nCount = Number(count)
      if (!isInteger(nCount) || nCount <= 0) return '参数错误。'
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
}
