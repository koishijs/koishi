import { Context, getUsage, Session, checkTimer, checkUsage, User, Random } from 'koishi'
import { Adventurer } from './utils'
import Affinity from './affinity'
import Phase from './phase'
import Item from './item'

namespace Luck {
  export const MAX_LUCKY = 50
  export const DEFAULT_BASE = 0.98

  export const fields = ['timers', 'luck'] as const
  export type Field = typeof fields[number]

  export function restrict(luck: number) {
    return Math.min(Math.max(luck, -MAX_LUCKY), MAX_LUCKY)
  }

  export function coefficient(user: Adventurer.Readonly<'timers'>) {
    return checkTimer('$reverseLucky', user as Adventurer) ? -1 : 1
  }

  export function get(user: Adventurer.Readonly<Field>) {
    return restrict(
      (coefficient(user) * user.luck) +
      (checkTimer('$mellow', user as Adventurer) ? 10 : 0) +
      (checkTimer('$luckyBonus', user as Adventurer) ? 5 : 0),
    )
  }

  export function use(user: Adventurer.Readonly<Field>, base = DEFAULT_BASE) {
    return new Random(1 / (1 + (1 / Math.random() - 1) * base ** get(user)))
  }

  export const probabilities: Record<Item.Rarity, number> = {
    N: 500,
    R: 300,
    SR: 160,
    SSR: 39,
    EX: 1,
    SP: 0,
  }

  export const allowanceProbabilities = {
    ...probabilities,
    N: 0,
    R: 0,
  }

  function showLotteryUsage(session: Session<User.Field>) {
    const due = session.user.timers.lottery
    const affinity = Affinity.get(session.user)
    const maxUsage = Math.floor(affinity / 30) + 5
    const nextUsage = due ? (Math.max(0, due - Date.now()) / 1000).toFixed() : 0
    return [
      `已调用次数：${Math.min(getUsage('lottery', session.user), maxUsage)}/${maxUsage}。`,
      `距离下次调用还需：${nextUsage}/${minInterval * 60} 秒。`,
      '十连抽卡不计入仓库，也不计入使用次数，但与普通抽卡共享冷却时间。',
    ].join('\n')
  }

  const minInterval = 5

  export function apply(ctx: Context) {
    ctx.command('adv/lottery', '每日抽卡')
      .userFields(['noSR'])
      .checkTimer('$system')
      .checkTimer('$lottery')
      .userFields(Adventurer.fields)
      .userFields(Affinity.fields)
      .option('quick', '-q  一次性抽完次数')
      .option('simple', '-s  省略物品描述')
      .option('tenTimes', '-t  十连抽卡')
      .shortcut('单次抽卡')
      .shortcut('简易抽卡', { options: { simple: true } })
      .shortcut('一键抽卡', { options: { quick: true, simple: true } })
      .shortcut('十连抽卡', { options: { tenTimes: true } })
      .usage(showLotteryUsage)
      .action(async ({ session, options }) => {
        const { user } = session
        if (Phase.userSessionMap[session.user.id]) return '当前处于剧情模式中，无法抽卡。'
        if (user.progress) return '检测到你有未完成的剧情，请尝试输入“继续当前剧情”。'

        if (checkTimer('lottery', user, minInterval * 60 * 1000)) {
          if (checkUsage('$lotteryHint', user, 1)) return
          return `抽卡调用存在 ${minInterval} 分钟的冷却时间，请稍后再试叭~`
        }

        if (options.tenTimes) {
          const output = [`恭喜 ${session.username} 获得了：`]
          for (let index = 10; index > 0; index--) {
            const prize = Item.pick(Item.data[Random.weightedPick(probabilities)], session, 'lottery', 1)
            output.push(`${prize.name}（${prize.rarity}）`)
          }
          return output.join('\n')
        }

        const affinity = Affinity.get(user)
        const maxUsage = Math.floor(affinity / 30) + 5
        session._lotteryLast = maxUsage - getUsage('lottery', user)
        if (session._lotteryLast <= 0) {
          return '调用次数已达上限。'
        }

        session._gains = new Set()
        const output: string[] = []
        function getPrize(output: string[]) {
          session._lotteryLast -= 1
          const weights = user.noSR >= 9 ? allowanceProbabilities : probabilities
          const rarity = Luck.use(user).weightedPick(weights)
          if (rarity === 'R' || rarity === 'N') {
            user.noSR += 1
          } else {
            user.noSR = 0
          }
          const item = Item.pick(Item.data[rarity], session, 'lottery', 1)
          const { name, description } = item
          const isOld = item.name in user.warehouse
          session._gains.add(name)
          session._item = name
          const result = Item.gain(session, item.name)
          if (options.simple && options.quick) {
            output.push(`${session._item}（${rarity}${isOld ? '' : '，首次'}）`)
          } else {
            output.push(`恭喜 ${session.username} ${isOld ? '' : '首次'}获得了${session._item}（${rarity}）！`)
          }
          if (!options.simple || !isOld) output.push(description)
          if (result) output.push(result)
        }

        if (!options.quick) {
          getPrize(output)
        } else {
          if (options.simple) output.push(`恭喜 ${session.username} 获得了：`)
          while (session._lotteryLast && !checkTimer('$lottery', user)) {
            getPrize(output)
          }
        }

        const result = Item.checkOverflow(session)
        if (result) output.push(result)
        user.usage.lottery = maxUsage - session._lotteryLast
        session.app.emit('adventure/check', session, output)
        await user.$update()

        if (!session._lotteryLast) output.push('您本日的抽奖次数已用完，请明天再试吧~')
        return output.join('\n').replace(/\$s/g, session.username)
      })
  }
}

export default Luck
