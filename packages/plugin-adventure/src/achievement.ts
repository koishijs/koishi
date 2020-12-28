import { User, Context, Session } from 'koishi-core'
import { difference, defineProperty, union, makeArray } from 'koishi-utils'
import { Show } from './utils'
import Profile from './profile'
import Rank from './rank'

declare module 'koishi-core/dist/session' {
  interface Session<U> {
    achieve(id: string, hints: string[], achieve?: boolean | boolean[]): string
  }
}

const levelName = 'ⅠⅡⅢⅣⅤ'

interface Achievement<T extends User.Field = never> {
  id: string
  category: string
  name: string | string[]
  desc: string | string[]
  descHidden?: string
  affinity: number
  count?: number
  progress?: (user: Pick<User, T>) => number
  hidden?: true | ((user: Pick<User, T>) => boolean)
  parent?: Achievement
}

interface Category {
  name?: string
  data: Achievement[]
}

namespace Achievement {
  export let theoretical = 0
  const catMap: Record<string, Category> = {}
  const achvMap: Record<string, Achievement> = {}
  const categories: Category[] & Record<string, Category> = [] as any
  const data: Achievement[] & Record<string, Achievement> = [] as any
  const fields = new Set<User.Field>(['achievement', 'name', 'flag'])

  export type Field = 'achievement' | 'name' | 'flag' | 'wealth' | 'money'

  Session.prototype.achieve = function (this: Session<Field>, id, hints, achieve = true) {
    const { $user, $app } = this
    if (!achieve || $user.achievement.includes(id)) return
    const achv = data[id]
    const currentLevel = getLevel($user, achv)
    if (typeof achv.desc === 'string') {
      if (currentLevel) return
      $user.achievement.push(id)
    } else {
      const targetLevel = makeArray(achieve).reduce((prev, curr, index) => curr ? index + 1 : prev, 0)
      if (currentLevel >= targetLevel) return
      if (!currentLevel) {
        $user.achievement.push(id += '-' + targetLevel)
      } else {
        const index = $user.achievement.indexOf(`${id}-${currentLevel}`)
        $user.achievement[index] = id += '-' + targetLevel
      }
    }

    hints.push(`恭喜 ${$user.name} 获得了成就「${data[id].name}」！`)
    $app.emit('adventure/achieve', this, data[id], hints)
    return hints.join('\n')
  }

  Profile.add(({ achvCount, achvRank }) => {
    return `成就已获得：${achvCount}/${data.length}${achvRank ? ` (#${achvRank})` : ''}`
  }, ['achvCount', 'achvRank'], 100)

  Rank.value('achievement', ['成就'], 'list_length(`achievement`)', { format: ' 个', key: 'achvRank' })

  export interface Standalone extends Achievement {
    name: string
    desc: string
  }

  function findAchievements(names: string[]) {
    const notFound: string[] = [], ids: string[] = []
    for (const name of names) {
      if (achvMap[name]) {
        ids.push(achvMap[name].id)
      } else {
        notFound.push(name)
      }
    }
    return { ids, notFound }
  }

  function getLevel(user: Pick<User, 'achievement'>, { id, desc }: Achievement) {
    if (typeof desc === 'string') return +user.achievement.includes(id)
    const item = user.achievement.find(item => item.startsWith(id))
    return item ? +item.slice(id.length + 1) : 0
  }

  function getHidden(user: Pick<User, 'achievement'>, { hidden }: Achievement) {
    return typeof hidden === 'function' ? hidden(user) : hidden
  }

  export function affinity(user: Pick<User, 'achievement'>, achvs: Achievement[] = data) {
    return achvs.reduce((prev, achv) => prev + getLevel(user, achv) * achv.affinity, 0)
  }

  function getCategory(id: string) {
    if (!categories[id]) {
      const cat: Category = { data: [] }
      categories.push(cat)
      defineProperty(categories, id, cat)
    }
    return categories[id]
  }

  function getChildren(achv: Achievement) {
    return typeof achv.desc === 'string'
      ? [achv as Standalone]
      : achv.desc.map((_, i) => data[`${achv.id}-${i + 1}`] as Standalone)
  }

  function checkHidden(user: Pick<User, 'achievement'>, name: string) {
    const achv = achvMap[name]
    return !getLevel(user, achv) && getHidden(user, achv)
  }

  export function add<T extends User.Field = never>(achv: Achievement<T>, userFields: Iterable<T> = []) {
    data.push(achv)
    defineProperty(data, achv.id, achv)
    if (typeof achv.name === 'string') {
      Show.redirect(achv.name, 'achv', checkHidden)
      achvMap[achv.name] = achv
    }
    if (typeof achv.desc === 'string') {
      theoretical += achv.affinity
    } else {
      achv.desc.forEach((desc, index) => {
        theoretical += achv.affinity
        const subAchv: Achievement.Standalone = Object.create(achv)
        subAchv.count = 0
        subAchv.desc = desc
        subAchv.parent = achv
        subAchv.id = `${achv.id}-${index + 1}`
        defineProperty(data, subAchv.id, subAchv)
        if (typeof achv.name === 'string') {
          subAchv.name = `${achv.name} ${levelName[index]}`
        } else {
          subAchv.name = achv.name[index]
          Show.redirect(subAchv.name, 'achv', checkHidden)
          achvMap[subAchv.name] = achv
        }
      })
    }
    for (const field of userFields) {
      fields.add(field)
    }
    getCategory(achv.category).data.push(achv)
  }

  export function category(id: string, ...names: string[]) {
    const category = getCategory(id)
    category.name = names[0]
    for (const name of names) {
      Show.redirect(name, 'achv')
      catMap[name] = category
    }
  }

  interface Options {
    forced?: boolean
    achieved?: boolean
    unachieved?: boolean
  }

  function showCategories(target: User.Observed) {
    let total = 0
    const output = Object.values(categories).map(({ name, data }) => {
      const count = data.filter(achv => getLevel(target, achv)).length
      total += count
      return `${name} (${count}/${data.length})`
    })

    output.unshift(`${target.name}，您已获得 ${total}/${data.length} 个成就，奖励好感度：${affinity(target)}`)
    output.push('要查看特定的成就或分类，请输入“四季酱，成就 成就名/分类名”。')
    return output.join('\n')
  }

  function showCategoryForced({ name, data }: Category) {
    let theoretical = 0
    const output = data.map((achv) => {
      const children = getChildren(achv)
      theoretical += children.length * achv.affinity
      return typeof achv.name === 'string'
        ? `${achv.name} (${children.map(achv => `#${achv.count}`).join(' => ')})`
        : children.map(({ name, count }) => `${name} (#${count})`).join(' => ')
    })
    output.unshift(`「${name}」\n成就总数：${data.length}，理论好感度：${theoretical}`)
    output.push('要查看特定成就的取得条件，请输入“四季酱，成就 成就名”。')
    return output.join('\n')
  }

  function getProgress(target: User.Observed, achv: Achievement) {
    const { progress = () => 0 } = achv
    return `（${(progress(target) * 100).toFixed()}%）`
  }

  function showCategory(target: User.Observed, { name, data }: Category, options: Options) {
    const { achieved, unachieved } = options
    let count = 0
    const output = data.map((achv) => {
      const level = getLevel(target, achv)
      if (level) count++
      if (achieved && !unachieved && !level) return
      if (!achieved && unachieved && level) return
      if (level) {
        const name = typeof achv.name !== 'string'
          ? getChildren(achv)[level - 1].name
          : achv.name
        return `${name}（已获得 +${level * achv.affinity}）`
      }

      const { name, hidden } = achv
      const isHidden = !level && (typeof hidden === 'function' ? hidden(target) : hidden)
      if (!achieved && !unachieved && isHidden) return
      return `${isHidden ? '？？？？' : makeArray(name)[level && level - 1]}${getProgress(target, achv)}`
    }).filter(Boolean)

    const bonus = affinity(target, data)
    output.unshift(`「${name}」\n${target.name}，您已达成 ${count}/${data.length} 个成就，奖励好感度：${bonus}`)
    output.push('要查看特定成就的取得条件，请输入“四季酱，成就 成就名”。')
    return output.join('\n')
  }

  export function apply(ctx: Context) {
    ctx.command('adventure/achievement [name]', '成就信息', { maxUsage: 100, usageName: 'show' })
      .userFields(fields)
      .alias('achv')
      .shortcut('查看成就')
      .shortcut('我的成就')
      .shortcut('成就', { fuzzy: true })
      .option('achieved', '-a  显示已获得的成就')
      .option('unachieved', '-A  显示未获得的成就')
      .option('full', '-f  显示全部成就')
      .option('forced', '-F  强制查看', { authority: 4, hidden: true })
      .option('set', '-s  添加成就', { authority: 4 })
      .option('unset', '-S  删除成就', { authority: 4 })
      .adminUser(async ({ target, options, next }, ...names) => {
        if (options.set || options.unset) {
          const { ids, notFound } = findAchievements(names)
          if (notFound.length) {
            return `未找到成就${notFound.map(name => `“${name}”`).join('，')}。`
          }
          if (options.unset) {
            target.achievement = difference(target.achievement, ids)
          } else {
            target.achievement = union(target.achievement, ids)
          }
          return
        }

        const [key] = names
        if (!key) return showCategories(target)

        if (key in catMap) {
          if (options.full) options.achieved = options.unachieved = true
          return options.forced
            ? showCategoryForced(catMap[key])
            : showCategory(target, catMap[key], options)
        }

        const { forced } = options
        const achv = achvMap[key]
        if (!achv) return next().then(() => `没有找到成就「${key}」。`)

        const { name, affinity, desc, hidden, descHidden } = achv
        const currentLevel = getLevel(target, achv)
        const isHidden = !currentLevel && (typeof hidden === 'function' ? hidden(target) : hidden)
        if (isHidden && !forced) {
          if (!options['pass']) return `没有找到成就「${key}」。`
          return next().then(() => '')
        }

        // 多级成就，每级名称不同
        if (typeof name !== 'string') {
          return name.map((name, index) => {
            const status = forced ? ''
              : currentLevel > index ? `（已获得 +${affinity}）`
                : index ? '（未获得）' : getProgress(target, achv)
            return `成就「${name}」${status}\n${desc[index]}`
          }).join('\n')
        }

        // 使用唯一的成就名
        const output = makeArray(desc).map((levelDesc, index) => {
          return (typeof desc === 'string' ? '' : levelName[index] + ' ')
            + (!forced && !currentLevel && descHidden ? descHidden : levelDesc)
            + (currentLevel > index ? `（+${affinity}）` : '')
        })
        output.unshift(`成就「${name}」`)
        if (!forced) {
          output[0] += currentLevel ? `（已获得）` : getProgress(target, achv)
        }
        return output.join('\n')
      })

    ctx.on('connect', async () => {
      if (!data.length) return
      let sql = 'SELECT'
      for (const achv of data) {
        for (const { id } of getChildren(achv)) {
          sql += ` find_achv('${id}') AS '${id}',`
        }
      }
      const [result] = await ctx.database.query<[Record<string, number>]>(sql.slice(0, -1))
      for (const key in result) {
        const achv = data[key]
        if (!achv.parent) {
          achv.count = result[key]
        } else {
          const { id } = achv.parent
          const level = +key.slice(id.length + 1)
          for (let i = level; i > 0; --i) {
            data[`${id}-${i}`].count += result[key]
          }
        }
      }
    })
  }
}

export default Achievement
