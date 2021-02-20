import { User, Context } from 'koishi-core'
import { Time, Random } from 'koishi-utils'
import Profile from './profile'
import Rank from './rank'

type AffinityResult = [] | [number, string]
type AffinityCallback<T extends User.Field = never> = (user: Pick<User, T>, date: number) => void | AffinityResult
type TheoreticalAffinityCallback = () => AffinityResult
type HintCallback<T extends User.Field = User.Field> = (user: Pick<User, T>, now: Date) => Iterable<string>

export interface Affinity<T extends User.Field = never> {
  order: number
  callback: AffinityCallback<T>
  theoretical: TheoreticalAffinityCallback
}

const affinityList: Affinity[] = []
const hintList: HintCallback[] = []

export namespace Affinity {
  export const fields = new Set<User.Field>(['name', 'affinity'])
  export const hintFields = new Set<User.Field>()

  export function add<T extends User.Field = never>(
    order: number,
    callback: AffinityCallback<T>,
    fields: Iterable<T>,
    theoretical: TheoreticalAffinityCallback = () => [],
  ) {
    const index = affinityList.findIndex(a => a.order < order)
    if (index >= 0) {
      affinityList.splice(index, 0, { order, callback, theoretical })
    } else {
      affinityList.push({ order, callback, theoretical })
    }
    for (const field of fields || []) {
      Affinity.fields.add(field)
    }
  }

  export function hint<T extends User.Field = never>(callback: HintCallback<T>, fields: Iterable<T> = []) {
    hintList.push(callback)
    for (const field of fields) {
      hintFields.add(field)
    }
  }

  function getAffinityItems(user: Partial<User>, date = Time.getDateNumber()) {
    return affinityList.map(a => a.callback(user, date) || [] as AffinityResult)
  }

  export function get(user: Partial<User>) {
    const affinity = getAffinityItems(user).reduce((prev, [curr, label]) => {
      if (!label) return prev
      return prev + curr
    }, 0)
    if ('affinity' in user) user.affinity = affinity
    return affinity
  }

  export function apply(ctx: Context) {
    ctx.before('connect', () => {
      Profile.add(user => `好感度：${Affinity.get(user)}`, fields, 20)
    })

    ctx.command('adventure/affinity', '查看好感度', { maxUsage: 100, usageName: 'show' })
      .alias('aff')
      .userFields(fields)
      .userFields(hintFields)
      .option('theoretical', '-t  查看好感度理论值')
      .alias('好感度')
      .shortcut('查看好感度')
      .shortcut('我的好感度')
      .shortcut('好感度理论值', { options: { theoretical: true } })
      .action(async ({ session, options }) => {
        const output: string[] = []
        const hints: string[] = []
        let total = 0

        const items = options.theoretical ? affinityList.map(a => a.theoretical()) : getAffinityItems(session.user)

        for (const [value, label] of items) {
          if (!label) continue
          total += value
          output.push(`${label} ${value > 0 ? '+' : ''}${value}`)
        }

        const date = new Date()
        for (const callback of hintList) {
          for (const hint of callback(session.user, date)) {
            hints.push(hint)
          }
        }

        if (options.theoretical) {
          output.unshift(`好感度理论最高值为 ${total}`)
        } else {
          output.unshift(`四季酱对 ${session.$username} 的好感度是 ${total}`)
          if (total >= 200) {
            hints.push('四季酱也最喜欢你了呢！')
          } else if (total >= 150) {
            hints.push(
              '原来你这么喜欢四季酱的嘛……诶嘿嘿~',
              '四季酱才……才没有对你心动什么的呢',
            )
          } else if (total >= 100) {
            hints.push(
              '好感度再高也不会变成你女朋友的（缩）',
              '好感度再高，有罪也是要被审判的啦！',
            )
          } else if (total >= 50) {
            hints.push('勉强及格了，表扬！但还要努力哦（敲头）')
          }
          if (hints.length) output.push(Random.pick(hints))
        }

        return output.join('\n')
      })
  }
}

Rank.add('affinity', {
  names: ['好感度', '好感'],
  fields: Affinity.fields,
  value: Affinity.get,
  order: '`affinity` DESC',
  limit: 100,
})

export default Affinity
