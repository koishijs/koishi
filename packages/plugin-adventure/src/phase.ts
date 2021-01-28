import { Context, User, Session, checkTimer, checkUsage } from 'koishi-core'
import { Logger, Random, interpolate, noop, Time } from 'koishi-utils'
import { ReadonlyUser, getValue, Adventurer, Shopper, Show } from './utils'
import Event from './event'
import {} from 'koishi-plugin-common'
import {} from 'koishi-plugin-teach'
import Rank from './rank'
import Item from './item'
import Buff from './buff'

declare module 'koishi-core/dist/session' {
  interface Session<U> {
    /** skip current phase */
    _skipCurrent?: boolean
    /** skip all read phase */
    _skipAll?: boolean
    /** is able to skip current phase */
    _canSkip?: boolean
    /** 即将获得的道具名 */
    _item: string
  }
}

export interface Phase<S = {}> {
  prepare?: () => S
  texts?: string[]
  items?: Record<string, ReadonlyUser.Infer<string>>
  choices?: Phase.Choice[]
  options?: Phase.ChooseOptions
  next?: string | Phase.Action<S>
  itemsWhenDreamy?: string[]
  events?: Event[]
}

export namespace Phase {
  const logger = new Logger('adventure')

  export const mainPhase: Phase = { items: {} }
  export const phaseMap: Record<string, Adventurer.Infer<Phase>> = { '': mainPhase }
  export const salePlots: Record<string, ReadonlyUser.Infer<string, Shopper.Field>> = {}

  export const metaMap: Record<number, Session<User.Field>> = {}
  export const groupStates: Record<number, number> = {}
  export const activeUsers = new Set<number>()

  export function getBadEndingCount(user: Pick<User, 'endings'>) {
    return Object.keys(user.endings).filter(id => badEndings.has(id)).length
  }

  export function checkStates(session: Session<'id'>, active = false) {
    // check group state
    const groupState = groupStates[session.groupId]
    if (session.subType === 'group' && groupState && groupState !== session.userId) {
      return '同一个群内只能同时进行一处剧情，请尝试私聊或稍后重试。'
    }

    // check user state
    const _meta = metaMap[session.userId]
    if (_meta && !(active && _meta.channelId === session.channelId && activeUsers.has(session.$user.id))) {
      return '同一用户只能同时进行一处剧情。'
    }
  }

  export function sendEscaped(session: Session<Adventurer.Field>, message: string | void, ms?: number) {
    if (!message) return
    message = session.$app.chain('adventure/text', message, session)
    return session.sendQueued(message, ms)
  }

  export function use(name: string, next: string, phase: Adventurer.Infer<Phase>): void
  export function use(name: string, next: (user: ReadonlyUser) => string): void
  export function use(name: string, next: ReadonlyUser.Infer<string>, phase?: Adventurer.Infer<Phase>) {
    mainPhase.items[name] = next
    if (typeof next === 'string' && phase) {
      phaseMap[next] = phase
    }
  }

  export function sell(name: string, next: string, phase: Adventurer.Infer<Phase>): void
  export function sell(name: string, next: (user: ReadonlyUser) => string): void
  export function sell(name: string, next: ReadonlyUser.Infer<string>, phase?: Adventurer.Infer<Phase>) {
    salePlots[name] = next
    if (typeof next === 'string' && phase) {
      phaseMap[next] = phase
    }
  }

  export function phase(id: string, phase: Adventurer.Infer<Phase>) {
    return phaseMap[id] = phase
  }

  export const endingMap: Record<string, string> = {}
  export const endingCount: Record<string, number> = {}
  export const reversedEndingMap: Record<string, string> = {}
  /** 键：prefix，值：[剧情线名，结局数] */
  export const lines: Record<string, [string, number]> = {}
  export const badEndings = new Set<string>()

  function checkLine(user: Pick<User, 'endings'>, target: string) {
    return !Object.keys(user.endings).some(name => name.startsWith(target))
  }

  function checkEnding(user: Pick<User, 'endings'>, target: string) {
    return !(target in user.endings)
  }

  export function ending(prefix: string, name: string, map: Record<string, string>, bad: Pick<string, 'includes'> = '') {
    if (prefix in lines) {
      lines[prefix][1] += Object.keys(map).length
    } else {
      lines[prefix] = [name, Object.keys(map).length]
      Show.redirect(name, 'ending', checkLine)
    }

    for (const id in map) {
      const name = `${prefix}-${id}`
      endingMap[name] = map[id]
      endingCount[name] = 0
      Show.redirect(map[id], 'ending', checkEnding)
      reversedEndingMap[map[id]] = name
      if (bad.includes(id)) {
        badEndings.add(name)
      }
    }
  }

  export function setProgress(user: User.Observed<'progress' | 'phases'>, progress: string | void) {
    if (user.progress) {
      const index = user.phases.indexOf(user.progress)
      if (index >= 0) user.phases.splice(index, 1)
      user.phases.unshift(user.progress)
    }
    user.progress = progress || ''
    return user._update()
  }

  export function getPhase(user: Adventurer) {
    const phase = getValue(phaseMap[user.progress], user)
    return phase || (user.progress = '', null)
  }

  export type Action<S = {}> = (session: Session<Adventurer.Field>, state?: S) => Promise<string | void>

  const HOOK_PENDING_USE = 4182
  const HOOK_PENDING_CHOOSE = 4185

  export interface Choice {
    name?: string
    text: string
    next: Adventurer.Infer<string>
    when?(user: ReadonlyUser): boolean
  }

  export interface ChooseOptions {
    autoSelect?: boolean
    onSelect?(name: string, user: Adventurer): void
    onDrunk?(user: Adventurer): number
  }

  export const choose = (choices: Choice[], options: ChooseOptions = {}): Action => async (session) => {
    const { $user, $app } = session
    const { autoSelect, onSelect, onDrunk } = options
    choices = choices.filter(({ when }) => !when || when($user))

    if (choices.length === 1 && autoSelect) {
      logger.debug('%s choose auto', session.userId)
      return getValue(choices[0].next, $user)
    }

    const choiceMap: Record<number, Choice> = {}
    const output = choices.map((choice, index) => {
      choiceMap[index] = choice
      return `${String.fromCharCode(65 + index)}. ${choice.text}`
    }).join('\n')

    function applyChoice(choice: Choice) {
      const { text, next, name = text } = choice
      if (onSelect) onSelect(name, $user)
      return getValue(next, $user)
    }

    if (checkTimer('$drunk', $user)) {
      await sendEscaped(session, output)
      const index = onDrunk?.($user) ?? Random.int(choices.length)
      logger.debug('%s choose drunk %c', session.userId, String.fromCharCode(65 + index))
      $user.drunkAchv += 1
      const hints = [`$s 醉迷恍惚，随手选择了 ${String.fromCharCode(65 + index)}。`]
      $app.emit('adventure/check', session, hints)
      await sendEscaped(session, hints.join('\n'))
      return applyChoice(choices[index])
    }

    session._skipCurrent = false
    await sendEscaped(session, '请输入选项对应的字母继续游戏。若 2 分钟内未选择，则默认随机选择。\n' + output, 0)

    const { predecessors } = $app.getSessionState(session)
    predecessors[HOOK_PENDING_CHOOSE] = null

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        logger.debug('%s choose timeout', session.userId)
        _resolve(applyChoice(Random.pick(choices)))
      }, 120000)

      const disposeListener = $app.on('adventure/use', (userId, progress) => {
        if (userId !== $user.id) return
        _resolve(progress)
      })

      const disposeMiddleware = session.middleware((session, next) => {
        const message = session.content.trim().toUpperCase()
        if (message.length !== 1) return next()
        logger.debug('%s choose %c', session.userId, message)
        const key = message.charCodeAt(0) - 65
        if (!choiceMap[key]) return next()
        _resolve(applyChoice(choiceMap[key]))
      })

      function _resolve(value: string) {
        delete predecessors[HOOK_PENDING_CHOOSE]
        disposeMiddleware()
        disposeListener()
        clearTimeout(timer)
        resolve(value)
      }
    })
  }

  export const useItem = (items: Record<string, ReadonlyUser.Infer<string>>): Action => async (session) => {
    if (!items) return
    const { $user, $app } = session

    if (checkTimer('$use', $user)) {
      logger.debug('%s use disabled', session.userId)
      return getValue(items[''], $user)
    }

    // drunk: use random item
    if (checkTimer('$drunk', $user)) {
      const nextMap: Record<string, string> = {}
      for (const name in items) {
        if (name && !$user.warehouse[name]) continue
        const next = getValue(items[name], $user)
        if (next) nextMap[name] = next
      }
      const name = Random.pick(Object.keys(nextMap))
      logger.debug('%s use drunk %c', session.userId, name)
      $user.drunkAchv += 1
      const hints = [name ? `$s 醉迷恍惚，随手使用了${name}。` : `$s 醉迷恍惚，没有使用任何物品！`]
      $app.emit('adventure/check', session, hints)
      await sendEscaped(session, hints.join('\n'))
      return nextMap[name]
    }

    session._skipCurrent = false
    await sendEscaped(session, '你现在可以使用特定的物品。若 5 分钟内未使用这些物品之一，将视为放弃使用。你也可以直接输入“不使用任何物品”跳过这个阶段。', 0)

    const { predecessors } = $app.getSessionState(session)
    predecessors[HOOK_PENDING_USE] = null

    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        disposeListener()
        logger.debug('%s use timeout', session.userId)
        _resolve(getValue(items[''], $user))
      }, 300000)

      const disposeListener = $app.on('adventure/use', (userId, progress) => {
        if (userId !== $user.id) return
        disposeListener()
        clearTimeout(timer)
        _resolve(progress)
      })

      function _resolve(progress: string) {
        delete predecessors[HOOK_PENDING_USE]
        disposeListener()
        clearTimeout(timer)
        resolve(progress)
      }
    })
  }

  /** display phase texts */
  export async function print(session: Session<Adventurer.Field>, texts: string[], canSkip = true, state = {}) {
    session._canSkip = canSkip
    if (!session._skipAll || !session._canSkip) {
      for (const text of texts || []) {
        if (session._skipCurrent) break
        await sendEscaped(session, interpolate(text, state))
      }
    }
    session._canSkip = false
  }

  /** handle events */
  async function epilog(session: Session<Adventurer.Field>, events: Event[] = []) {
    const hints: string[] = []
    for (const event of events || []) {
      const result = event(session)
      if (!session._skipAll) {
        await sendEscaped(session, result)
      } else if (result) {
        hints.push(result)
      }
    }

    session.$app.emit('adventure/check', session, hints)
    await sendEscaped(session, hints.join('\n'))
  }

  export const plot: Action = async (session) => {
    const { $user } = session

    // resolve phase
    const phase = getPhase($user)
    if (!phase) return logger.warn('phase not found %c', $user.progress)

    logger.debug('%s phase %c', session.userId, $user.progress)
    const { items, choices, next, options, prepare = noop } = phase

    const state = prepare()
    await print(session, phase.texts, $user.phases.includes($user.progress), state)
    await epilog(session, phase.events)

    // resolve next phase
    activeUsers.add($user.id)
    const action = typeof next === 'function' && next
      || choices && choose(choices, options)
      || items && useItem(items)
      || (async () => next as string)
    const progress = await action(session, state)
    activeUsers.delete($user.id)

    // save user data
    await setProgress($user, progress)
    if (!$user.phases.includes($user.progress)) {
      session._skipCurrent = false
    }

    // handle next phase
    if (progress) return plot(session)
    logger.debug('%s phase finish', session.userId)
  }

  export async function start(session: Session<Adventurer.Field>) {
    metaMap[session.userId] = session
    if (session.subType === 'group') {
      groupStates[session.groupId] = session.userId
    }
    try {
      await plot(session)
    } catch (error) {
      new Logger('cosmos').warn(error)
    }
    delete metaMap[session.userId]
    if (session.subType === 'group') {
      delete groupStates[session.groupId]
    }
  }

  function findEndings(names: string[]) {
    const notFound: string[] = [], ids: string[] = []
    for (const name of names) {
      if (endingMap[name]) {
        ids.push(name)
      } else if (reversedEndingMap[name]) {
        ids.push(reversedEndingMap[name])
      } else {
        notFound.push(name)
      }
    }
    return { ids, notFound }
  }

  export function apply(ctx: Context) {
    ctx.command('adventure/ending [story]', '查看结局', { maxUsage: 100, usageName: 'show' })
      .userFields(['id', 'endings', 'name', 'timers'])
      .alias('endings', 'ed')
      .shortcut('我的结局')
      .shortcut('查看结局')
      .option('add', '-a 添加结局', { authority: 4 })
      .option('remove', '-d 删除结局', { authority: 4 })
      .adminUser(async ({ session, options, target, next }, ...names) => {
        if (options.add || options.remove) {
          if (!names.length) return '请输入要删除的结局名。'
          const { notFound, ids } = findEndings(names)
          if (notFound.length) {
            return `未找到结局${notFound.map(name => `“${name}”`).join('，')}。`
          }
          for (const id of ids) {
            options.add ? target.endings[id] = (target.endings[id] || 0) + 1 : delete target.endings[id]
          }
          return
        }

        const { endings } = session.$user
        const storyMap: Record<string, string[]> = {}
        for (const ending in endings) {
          const [prefix] = ending.split('-', 1)
          if (!storyMap[prefix]) storyMap[prefix] = []
          storyMap[prefix].push(endingMap[ending])
        }

        if (names.length) {
          const name = names[0].toLowerCase()
          const id = reversedEndingMap[name]
          if (id) {
            const [prefix] = id.split('-', 1)
            return [
              `结局「${name}」${badEndings.has(id) ? `（BE）` : ''}`,
              `来源：${lines[prefix][0]}剧情线`,
              `你已达成：${endings[id] || 0} 次`,
            ].join('\n')
          }

          const titles = storyMap[name]
          if (!titles) return options['pass'] ? next().then(() => '') : `你尚未解锁剧情「${name}」。`
          const output = titles.map((name) => {
            const id = reversedEndingMap[name]
            return `${id}. ${name}×${endings[id]}${badEndings.has(id) ? `（BE）` : ''}`
          }).sort()
          const [title, count] = lines[name]
          output.unshift(`${session.$username}，你已达成${title}剧情线的 ${titles.length}/${count} 个结局：`)
          return output.join('\n')
        }

        const output = Object.keys(storyMap).sort().map((key) => {
          const { length } = storyMap[key]
          let output = `${key} (${length}/${lines[key][1]})`
          if (length) output += '：' + storyMap[key].join('，')
          return output
        })
        const totalCount = Object.keys(endingMap).length
        const totalBadCount = badEndings.size
        const userCount = Object.keys(endings).length
        const userBadCount = getBadEndingCount(session.$user)
        output.unshift(`${session.$username}，你已达成 ${userCount}/${totalCount} 个结局（BE: ${userBadCount}/${totalBadCount}）。`)
        return output.join('\n')
      })

    ctx.on('adventure/rank', (name) => {
      return reversedEndingMap[name] && ['rank.ending', name]
    })

    ctx.command('rank.ending [name]', '显示结局达成次数排行')
      .useRank()
      .action(async ({ session, options }, name) => {
        if (!name) return '请输入结局名。'
        if (!endingMap[name]) {
          name = reversedEndingMap[name]
          if (!name) return '请输入正确的结局名。'
        }
        return Rank.show({
          names: [endingMap[name]],
          value: `json_extract(\`endings\`, '$."${name}"')`,
          format: ' 次',
        }, session, options)
      })

    ctx.command('adventure/continue', '继续剧情', { maxUsage: 10 })
      .userFields(Adventurer.fields)
      .checkTimer('$system')
      .shortcut('继续剧情')
      .shortcut('继续当前剧情')
      .usage([
        '使用“四季酱，使用 <道具名>”开始一段剧情。',
        '当有剧情进行到一半时发生系统更新等特殊情况时，可以通过本命令恢复当前剧情的状态。如有特殊情况，可以联系作者解决。',
      ].join('\n'))
      .action(async ({ session }) => {
        // assert user progress
        if (!session.$user.progress) return

        const message = checkStates(session)
        if (message) return message

        return start(session)
      })

    ctx.command('adventure/skip [-- command...]', '跳过剧情')
      .shortcut('跳过剧情')
      .shortcut('跳过当前剧情')
      .userFields(['phases', 'progress'])
      .useRest()
      .usage('这个指令用于跳过剧情的主体部分，并不会略去结算文字。当进入下一段剧情时需要再次跳过。未读过的剧情无法跳过。')
      .action(async ({ session, next, options }) => {
        if (options.rest) {
          session._skipAll = true
          await session.execute(options.rest, next)
          session._skipAll = false
          return
        }
        if (session._skipAll) return
        if (!(session = metaMap[session.userId])) return
        if (session._skipCurrent || !session._canSkip) return
        session.cancelQueued()
        session._skipCurrent = true
      })

    ctx.command('adventure/use [item]', '使用物品', { maxUsage: 100 })
      .userFields(['progress'])
      .userFields(Adventurer.fields)
      .checkTimer('$system')
      .shortcut('使用', { fuzzy: true })
      .shortcut('不使用物品', { options: { nothing: true } })
      .shortcut('不使用任何物品', { options: { nothing: true } })
      .option('nothing', '-n  不使用任何物品，直接进入下一剧情')
      .action(({ session, options }) => {
        if (options.nothing) return
        const user = session.$user
        if (!checkTimer('$use', user)) return
        const buff = Buff.timers['$use']
        if (!checkUsage('$useHint', user, 1)) {
          const rest = user.timers['$use'] - Date.now()
          session.send(`您当前处于「${buff[0]}」状态，无法调用本功能，剩余 ${Time.formatTime(rest)}。`)
        }
        return ''
      })
      .action(async (argv, item) => {
        const { options, session } = argv
        const { $user } = session
        const message = checkStates(session, true)
        if (message) return message

        if (!item && !options.nothing) return '请输入物品名。'
        if (item && !Item.data[item]) return Item.suggest(argv)

        const possess = Item.data.map(i => i.name).filter(name => $user.warehouse[name])
        const result = ctx.bail('adventure/before-use', item, session)
        if (result) return result

        const phase = getPhase($user)
        if (!phase) return

        const { items: itemMap = {}, itemsWhenDreamy = [] } = phase
        const usableItems = checkTimer('$dream', $user)
          ? new Set([...itemsWhenDreamy, ...possess])
          : new Set(possess)

        if (options.nothing) item = ''
        if (item && !usableItems.has(item)) {
          if (session._skipAll) return
          return `你暂未持有物品“${item}”。`
        }

        const progress = getValue(itemMap[item], $user)
        if (progress) {
          logger.debug('%s use %c', session.$user.id, item)
          if (activeUsers.has(session.$user.id)) {
            await ctx.parallel('adventure/use', session.$user.id, progress)
            return
          }

          $user['_skip'] = session._skipAll
          await setProgress($user, progress)
          return start(session)
        } else {
          if (!item || session._skipAll) return
          const next = !metaMap[session.userId] && getValue(mainPhase.items[item], $user)
          if (next) {
            return `物品“${item}”当前不可用，请尝试输入“继续当前剧情”。`
          } else {
            return `物品“${item}”不可用。`
          }
        }
      })

    ctx.on('connect', async () => {
      let sql = 'SELECT'
      for (const id in endingCount) {
        sql += ` find_ending('${id}') AS '${id}',`
      }
      const [data] = await ctx.database.query<[Record<string, number>]>(sql.slice(0, -1))
      for (const key in data) {
        endingCount[key] = data[key]
      }
    })
  }
}

export default Phase
