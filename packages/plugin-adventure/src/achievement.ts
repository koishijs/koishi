import { User, Context, Session } from 'koishi-core'
import { difference, defineProperty } from 'koishi-utils'
import { achvH, achvS, showMap } from './utils'
import Affinity from './affinity'
import Profile from './profile'
import Rank from './rank'

export type AchvField = 'achievement' | 'name' | 'flag' | 'wealth' | 'money'

declare module 'koishi-core/dist/session' {
  interface Session<U> {
    achieve: {
      (id: string, achieve?: boolean, achieveEx?: boolean): string
      (id: string, hints: string[], achieve?: boolean, achieveEx?: boolean): string
    }
  }
}

Session.prototype.achieve = function (this: Session<AchvField>, id: string, ...args: [boolean?, boolean?] | [string[], boolean?, boolean?]) {
  const { $user, $app } = this
  const hints = Array.isArray(args[0]) ? args.shift() as string[] : []
  const [achieve = true, achieveEx = false] = args as boolean[]
  if (!achieve) return
  if ($user.achievement.includes(id + '-ex')) return
  const index = $user.achievement.indexOf(id)

  // 表成就
  if (!achieveEx) {
    if (index >= 0) return
    $user.achievement.push(id)
    const { count, name } = Achievement.data[id]
    if (!($user.flag & User.Flag.noLeading)) {
      const reward = leaderReward[count]
      if (reward) {
        $app.broadcast(`恭喜 ${$user.name} 获得了成就「${name}」的全服${leaderName[count]}，将获得 ${reward}￥ 的奖励！`).catch()
        $user.money += reward
        $user.wealth += reward
      }
      Achievement.data[id].count += 1
    }
    const hint = `恭喜 ${$user.name} 获得了成就「${name}」！`
    return hints.push(hint), hint
  }

  // 如果未获得表成就无法获得里成就
  if (index < 0 && !achieve) return

  // 里成就
  if (index >= 0) {
    $user.achievement[index] += '-ex'
  } else {
    $user.achievement.push(id + '-ex')
  }
  const { countEx, nameEx } = Achievement.data[id]
  if (!($user.flag & User.Flag.noLeading)) {
    const reward = leaderReward[countEx]
    if (reward) {
      $app.broadcast(`恭喜 ${$user.name} 拿下了成就「${nameEx}」的全服${leaderName[countEx]}，获得了 ${reward}￥ 的奖励！`).catch()
      $user.money += reward
      $user.wealth += reward
    }
    Achievement.data[id].countEx += 1
    if (index < 0) Achievement.data[id].count += 1
  }
  const hint = `恭喜 ${$user.name} 获得了成就「${nameEx}」！`
  return hints.push(hint), hint
}

const leaderReward = [1000, 500, 200]
const leaderName = ['首杀', '第二杀', '第三杀']

interface Achievement<T extends User.Field = User.Field> {
  id: string
  name: string
  nameEx?: string
  affinity: number
  desc: string
  descEx?: string
  descHidden?: string
  count?: number
  countEx?: number
  progress?: (user: Pick<User, T>) => number
  hidden?: true | ((user: Pick<User, T>) => boolean)
}

let theoretical = 0, achvSCount = 0, achvHCount = 0

Profile.add(({ achvS, achvH, achvRank }) => {
  return `成就已获得：${achvS}+${achvH}/${achvSCount}+${achvHCount}${achvRank ? ` (#${achvRank})` : ''}`
}, ['achvS', `achvH`, 'achvRank'], 100)

Rank.value('achievementSuperficial', ['表成就'], achvS, { format: ' 个' })
Rank.value('achievementHidden', ['里成就'], achvH, { format: ' 个' })
Rank.value('achievement', ['成就'], `${achvS} + ${achvH}`, {
  key: 'achvRank',
  fields: ['achvS', 'achvH'],
  order: '`achvS` DESC',
  format: user => `${user._value} (${user.achvS}+${user.achvH}) 个`,
})

Affinity.add(1000, (user) => {
  const value = Achievement.affinity(user)
  const label = value < 50 ? '初入幻想'
    : value < 100 ? '幻想居民'
      : value < 150 ? '见习自机'
        : value < 200 ? '异变黑幕'
          : '幻想传说'
  return [value, label]
}, ['achievement'], () => [theoretical, '幻想传说'])

Affinity.hint(function* (user) {
  if (!user.achievement.length) {
    yield '成就是好感度的基础，试试去完成几个成就再来吧~'
  }
}, ['achievement'])

namespace Achievement {
  export const data: Achievement[] & Record<string, Achievement> = [] as any
  export const fields = new Set<User.Field>(['achievement', 'name', 'flag'])

  function findAchievements(names: string[]) {
    const notFound: string[] = [], ids: string[] = []
    for (const name of names) {
      if (data[name]) {
        ids.push(data[name].id)
      } else if (/^.+·里$/.test(name)) {
        const omoteName = name.slice(0, -2)
        if (data[omoteName]) {
          ids.push(data[omoteName].id + '-ex')
        } else {
          notFound.push(name)
        }
      } else {
        notFound.push(name)
      }
    }
    return { ids, notFound }
  }

  export function affinity(user: Pick<User, 'achievement'>) {
    return data.reduce((prev, { id, affinity }) => {
      return prev += user.achievement.includes(id) ? affinity
        : user.achievement.includes(id + '-ex') ? affinity * 2 : 0
    }, 0)
  }

  function showAchvs(session: Session, target: User.Observed, options: Record<string, any>) {
    const { achievement } = target
    const { forced, achieved, unachieved, full, hidden: showHidden } = options
    const output = data.map(({ id, name, nameEx, hidden, progress = () => 0, affinity, descEx, count, countEx }) => {
      const hasNormal = achievement.includes(id)
      const hasEx = achievement.includes(id + '-ex')
      const hasNot = !hasNormal && !hasEx
      const isHidden = hasNot && (typeof hidden === 'function' ? hidden(target) : hidden)
      if (!full && !forced) {
        if (achieved && hasNot) return
        if (unachieved && !hasNot) return
        if (showHidden && !isHidden) return
        if (!showHidden && isHidden) return
      }
      if (forced) {
        let message = `${name}（${count}）`
        if (descEx) message += `=> ${nameEx}（${countEx}）`
        return message
      }
      if (hasEx) return `${name} => ${nameEx}（已获得 +${affinity * 2}）`
      if (hasNormal) return `${name}（已获得 +${affinity}${descEx ? '?' : ''}）`
      return `${isHidden ? '？？？？' : name}（${(progress(target) * 100).toFixed()}%）`
    }).filter(Boolean)

    if (forced) {
      output.unshift(`成就总数：${data.length}，理论好感度：${theoretical}`)
    } else {
      const bonus = affinity(target)
      output.unshift(`${session.$username}，您已获得成就：${achievement.length}/${data.length}，奖励好感度：${bonus}`)
    }

    output.push('要查看特定成就的取得条件，请输入“四季酱，成就 成就名”。')
    return output.join('\n')
  }

  export function add<T extends User.Field = never>(achv: Achievement<T>, fields: Iterable<T> = []) {
    data.push(achv)
    showMap[achv.name] = ['command', 'achv']
    defineProperty(data, achv.id, achv)
    defineProperty(data, achv.name, achv)
    defineProperty(data, achv.nameEx = achv.nameEx || achv.name + '·里', achv)
    achvSCount += 1
    achvHCount += (achv.descEx ? 1 : 0)
    theoretical += achv.affinity * (achv.descEx ? 2 : 1)
    for (const field of fields) {
      Achievement.fields.add(field)
    }
  }

  export function apply(ctx: Context) {
    ctx.command('adventure/achievement [name]', '查看成就信息', { maxUsage: 100, usageName: 'show' })
      .userFields(fields)
      .alias('成就', 'achv')
      .shortcut('查看成就')
      .shortcut('我的成就')
      .option('achieved', '-a  显示已获得的成就')
      .option('unachieved', '-A  显示未获得的成就')
      .option('full', '-f  显示全部成就')
      .option('forced', '-F  强制查看', { authority: 4, hidden: true })
      .option('hidden', '-H  显示隐藏成就')
      .option('set', '-s  添加成就', { authority: 4 })
      .option('unset', '-S  删除成就', { authority: 4 })
      .adminUser(async ({ session, target, options, next }, ...names) => {
        if (options.set || options.unset) {
          const { ids, notFound } = findAchievements(names)
          if (notFound.length) {
            return `未找到成就${notFound.map(name => `“${name}”`).join('，')}。`
          }
          if (options.unset) {
            target.achievement = difference(target.achievement, ids)
          } else {
            ids.forEach(id => {
              if (id.endsWith('-ex')) {
                const omoteNameIndex = target.achievement.indexOf(id.slice(0, -3))
                if (omoteNameIndex >= 0) {
                  target.achievement.splice(omoteNameIndex, 1)
                }
              } else {
                const exNameIndex = target.achievement.indexOf(id + '-ex')
                if (exNameIndex >= 0) {
                  target.achievement.splice(exNameIndex, 1)
                }
              }
              if (!target.achievement.includes(id)) {
                target.achievement.push(id)
              }
            })
          }
          return
        }

        const [key] = names
        if (!key) return showAchvs(session, target, options)

        const { achievement } = target
        const { forced } = options
        const achv = data[key]
        if (!achv) return `没有找到成就「${key}」。`

        const { id, name, nameEx, progress = () => 0, affinity, desc, hidden, descHidden, descEx } = achv
        const hasEx = achievement.includes(id + '-ex')
        if (nameEx === key && !hasEx && !forced) return `没有找到成就「${key}」。`

        const hasNormal = hasEx || achievement.includes(id)
        const hasNot = !hasNormal && !hasEx
        const isHidden = hasNot && (typeof hidden === 'function' ? hidden(target) : hidden)
        if (isHidden && !forced) {
          if (!options['pass']) return `没有找到成就「${key}」。`
          return next().then(() => '')
        }

        const output = [`名称：${hasEx ? `${name} => ${nameEx}` : name}`]
        if (!forced) {
          output[0] += hasNot ? `（${(progress(target) * 100).toFixed()}%）` : '（已获得）'
        }
        if (hasEx || forced && descEx) {
          output.push(`${desc}（+${affinity}）`, `${descEx}（+${affinity}）`)
        } else if (descEx && hasNormal) {
          output.push(`${desc}（+${affinity}?）`)
        } else {
          output.push(`${descHidden && !hasNormal && !forced ? descHidden : desc}（+${affinity}）`)
        }

        return output.join('\n')
      })

    ctx.on('connect', async () => {
      if (!data.length) return
      let sql = 'SELECT'
      for (const achv of data) {
        sql += ` find_achv('${achv.id}') AS '${achv.id}',`
        if (achv.descEx) sql += ` find_achv('${achv.id}-ex') AS '${achv.id}-ex',`
      }
      const [result] = await ctx.database.query<[Record<string, number>]>(sql.slice(0, -1))
      for (const key in result) {
        if (key.endsWith('-ex')) {
          const achv = data[key.slice(0, -3)]
          achv.count += (achv.countEx = result[key])
        } else {
          data[key].count = result[key]
        }
      }
    })
  }
}

export default Achievement
