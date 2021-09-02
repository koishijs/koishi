import { User, Context, Time, Random, Query } from 'koishi'
import Profile from './profile'
import Rank from './rank'
import type { Dialogue } from '@koishijs/plugin-teach'

declare module '@koishijs/plugin-teach' {
  interface DialogueTest {
    matchAffinity?: number
    mismatchAffinity?: number
  }

  interface Dialogue {
    minAffinity: number
    maxAffinity: number
  }

  interface SessionState {
    noAffinityTest?: boolean
  }
}

type AffinityResult = [] | [number, string]
type AffinityCallback<T extends User.Field = never> = (user: Pick<User, T>, date: number) => void | AffinityResult
type TheoreticalAffinityCallback = () => AffinityResult
type HintCallback<T extends User.Field = User.Field> = (user: Pick<User, T>, now: Date) => Iterable<string>

interface Affinity<T extends User.Field = never> {
  order: number
  callback: AffinityCallback<T>
  theoretical: TheoreticalAffinityCallback
}

const affinityList: Affinity[] = []
const hintList: HintCallback[] = []

namespace Affinity {
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
      // profile also needs affinity data
      Profile.fields.add(field)
    }
  }

  Profile.add(user => `好感度：${Affinity.get(user)}`, [], 20)

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
    ctx.command('adv/affinity', '查看好感度', { maxUsage: 100, usageName: 'show' })
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
          output.unshift(`四季酱对 ${session.username} 的好感度是 ${total}`)
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

    ctx.with(['teach'], integrateTeach)
  }

  function integrateTeach(ctx: Context) {
    ctx.command('teach', { patch: true })
      .option('minAffinity', '-a <aff:posint>  最小好感度')
      .option('maxAffinity', '-A <aff:posint>  最大好感度')
      .action(({ options }) => {
        if (options.maxAffinity === 0) options.maxAffinity = 32768
      })

    ctx.before('dialogue/search', ({ options }, test) => {
      if (options.minAffinity !== undefined) test.matchAffinity = options.minAffinity
      if (options.maxAffinity !== undefined) test.mismatchAffinity = options.maxAffinity
    })

    const createAffinityQuery = (affinity: number): Query.Expr<Dialogue> => ({
      maxAffinity: { $gt: affinity },
      minAffinity: { $lte: affinity },
    })

    ctx.on('dialogue/test', (test, query) => {
      if (test.matchAffinity !== undefined) {
        Object.assign(query, createAffinityQuery(test.matchAffinity))
      }
      if (test.mismatchAffinity !== undefined) {
        query.$and.push({
          $not: createAffinityQuery(test.mismatchAffinity),
        })
      }
    })

    ctx.on('dialogue/modify', async ({ options }, data) => {
      if (options.minAffinity !== undefined) data.minAffinity = options.minAffinity
      if (options.maxAffinity !== undefined) data.maxAffinity = options.maxAffinity
    })

    ctx.on('dialogue/detail', (dialogue, output) => {
      if (dialogue.minAffinity > 0) output.push(`最低好感度：${dialogue.minAffinity}`)
      if (dialogue.maxAffinity < 32768) output.push(`最高好感度：${dialogue.maxAffinity}`)
    })

    ctx.on('dialogue/detail-short', (dialogue, output) => {
      if (dialogue.minAffinity > 0) output.push(`a=${dialogue.minAffinity}`)
      if (dialogue.maxAffinity < 32768) output.push(`A=${dialogue.maxAffinity}`)
    })

    ctx.before('dialogue/attach-user', (state, fields) => {
      if (state.dialogue) return
      // 如果所有可能触发的问答都不涉及好感度，则无需获取好感度字段
      // eslint-disable-next-line no-cond-assign
      if (state.noAffinityTest = state.dialogues.every(d => !d._weight || !d.minAffinity && d.maxAffinity === 32768)) return
      for (const field of Affinity.fields) {
        fields.add(field)
      }
    })

    ctx.on('dialogue/attach-user', ({ session, dialogues, noAffinityTest }) => {
      if (noAffinityTest) return
      const affinity = Affinity.get(session.user)
      dialogues.forEach((dialogue) => {
        if (dialogue.minAffinity <= affinity && dialogue.maxAffinity > affinity) return
        dialogue._weight = 0
      })
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
