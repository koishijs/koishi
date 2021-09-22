import { Context, User, Session, checkTimer, Logger, Random, interpolate, Dict, Time } from 'koishi'
import { Adventurer, Show } from './utils'
import {} from '@koishijs/plugin-common'
import {} from '@koishijs/plugin-teach'
import Event from './event'
import Rank from './rank'
import Item from './item'

declare module 'koishi' {
  interface Session<U> {
    /** skip current phase */
    _skipCurrent?: boolean
    /** skip all read phase */
    _skipAll?: boolean
    /** is able to skip current phase */
    _canSkip?: boolean
    /** 即将获得的道具名 */
    _item: string
    /** 当前获得的物品列表 */
    _gains: Set<string>
    /** 剩余抽卡次数 */
    _lotteryLast: number
  }
}

interface Phase<S = any> extends Phase.ChooseOptions, Phase.UseOptions {
  prepare?: (session: Adventurer.Session) => S
  texts?: Adventurer.Infer<string[], S>
  items?: Dict<Adventurer.Infer<string, S>>
  choices?: Phase.Choice[]
  next?: string | Phase.Action<S>
  events?: Event<S>[]
}

namespace Phase {
  const logger = new Logger('adventure')

  export const mainEntry: Phase = { items: {} }
  export const registry: Dict<Phase> = { '': mainEntry }
  export const salePlots: Dict<Adventurer.Infer<string, Adventurer.Field>> = {}

  export const userSessionMap: Dict<[Adventurer.Session, NodeJS.Timer]> = {}
  export const channelUserMap: Dict<[string, NodeJS.Timer]> = {}
  export const activeUsers = new Map<string, any>()

  export function getBadEndingCount(user: Pick<User, 'endings'>) {
    return Object.keys(user.endings).filter(id => badEndings.has(id)).length
  }

  export function checkStates(session: Session<'id'>, active = false) {
    // check channel state
    const userState = channelUserMap[session.cid]
    if (session.subtype === 'group' && userState && userState[0] !== session.user.id) {
      return '同一个群内只能同时进行一处剧情，请尝试私聊或稍后重试。'
    }

    // check user state
    const sessionState = userSessionMap[session.user.id]
    if (sessionState && !(active && sessionState[0].cid === session.cid && activeUsers.has(session.user.id))) {
      return '同一用户只能同时进行一处剧情。'
    }
  }

  export function sendEscaped(session: Adventurer.Session, message: string | void, ms?: number) {
    if (!message) return
    return session.sendQueued(message.replace(/\$s/g, () => session.username), ms)
  }

  export function use<S>(name: string, next: string, phase: Phase<S>): void
  export function use(name: string, next: (user: Adventurer.Readonly) => string): void
  export function use(name: string, next: Adventurer.Infer<string>, phase?: Phase) {
    mainEntry.items[name] = next
    if (typeof next === 'string' && phase) {
      registry[next] = phase
    }
  }

  export function sell<S>(name: string, next: string, phase: Phase<S>): void
  export function sell(name: string, next: (user: Adventurer.Readonly) => string): void
  export function sell(name: string, next: Adventurer.Infer<string>, phase?: Phase) {
    salePlots[name] = next
    if (typeof next === 'string' && phase) {
      registry[next] = phase
    }
  }

  export function phase<S>(id: string, phase: Phase<S>): void {
    registry[id] = phase
  }

  export const endingMap: Dict<string> = {}
  export const endingCount: Dict<Set<string>> = {}
  export const reversedEndingMap: Dict<string> = {}
  /** 键：prefix，值：[剧情线名，结局数] */
  export const lines: Dict<[string, number]> = {}
  export const reversedLineMap: Dict<string> = {}
  export const badEndings = new Set<string>()

  function checkLine(user: Pick<User, 'endings'>, target: string) {
    const prefix = reversedLineMap[target]
    return !Object.keys(user.endings).some(name => name.startsWith(prefix))
  }

  function checkEnding(user: Pick<User, 'endings'>, target: string) {
    return !(target in user.endings)
  }

  export function ending(prefix: string, name: string, map: Dict<string>, bad: Pick<string, 'includes'> = '') {
    if (prefix in lines) {
      lines[prefix][1] += Object.keys(map).length
    } else {
      lines[prefix] = [name, Object.keys(map).length]
      reversedLineMap[name] = prefix
      Show.redirect(name, 'ending', checkLine)
    }

    for (const id in map) {
      const name = `${prefix}-${id}`
      endingMap[name] = map[id]
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
    return user.$update()
  }

  export function getPhase(user: Adventurer) {
    const phase = registry[user.progress]
    return phase || (user.progress = '', null)
  }

  export type Action<S = {}> = (session: Adventurer.Session, state?: S) => Promise<string | void>

  const HOOK_PENDING_USE = 4182
  const HOOK_PENDING_CHOOSE = 4185

  export interface Choice {
    /** 选项名 */
    name: string
    /** 实际显示的文本，默认与 `name` 相同 */
    text?: string
    /** 实际显示的序号，设置为 null 将不显示此选项（仍然可通过输入 `name` 的方式触发） */
    order?: string
    /** 触发选项后跳转到的下个阶段 */
    next: Adventurer.Infer<string>
    /** 选项出现的条件 */
    when?(user: Adventurer.Readonly): boolean
  }

  export interface CommonOptions {
    /** 供当前阶段交互提示使用的模板 */
    template?: string
    /**
     * 超时未选后的默认行为
     * - 当未设置时表现为在所有非隐藏分支中随机选择
     * - 如果这里指定为隐藏分支，则提示文本仍然显示为随机选择，但实际效果会进入该隐藏分支
     */
    onTimeout?: string
  }

  export interface ChooseOptions extends CommonOptions {
    /** 当仅有一个选项时，跳过此选择支 */
    autoSelect?: boolean
    /**
     * 醉酒后的默认行为
     * - 当未设置时表现为在所有非隐藏分支中随机选择
     * - 当设置了 `onTimeout` 时，醉酒状态将失效
     */
    onDrunk?: string
    onSelect?(name: string, user: Adventurer): void
  }

  export interface UseOptions extends CommonOptions {
    beforeUse?(session: Adventurer.Session, usable: Set<string>): void
  }

  export const choose = (choices: Choice[], options: ChooseOptions = {}): Action => async (session, state) => {
    const { user, app } = session
    const { autoSelect, onTimeout, onDrunk, onSelect } = options
    choices = choices.filter(({ when }) => !when || when(user))

    if (choices.length === 1 && autoSelect) {
      logger.debug('%s choose auto', session.userId)
      return Adventurer.getValue(choices[0].next, user, state)
    }

    let fallback: Choice
    const orderMap: Dict<string> = {}
    const choiceMap: Dict<Choice> = {}
    const output = choices.map((choice, index) => {
      const { name, order = String.fromCharCode(65 + index), text = name } = choice
      choiceMap[text.toUpperCase()] = choice
      if (name === onTimeout) fallback = choice
      if (!order) return
      choiceMap[order] = choice
      orderMap[name] = order
      return `${order}. ${text}`
    }).filter(Boolean).join('\n')

    function applyChoice(choice: Choice) {
      const { name, next } = choice
      if (onSelect) onSelect(name, user)
      return Adventurer.getValue(next, user, state)
    }

    if (!fallback && checkTimer('$drunk', user)) {
      await sendEscaped(session, output)
      const choice = onDrunk
        ? choices.find(c => c.name === onDrunk)
        : Random.pick(choices.filter(c => c.order !== null))
      logger.debug('%s choose drunk %c', session.userId, choice.name)
      if (onDrunk) user.drunkAchv += 1
      const hints: string[] = []
      if (choice.order !== null) {
        hints.push(`$s 醉迷恍惚，随手选择了 ${orderMap[choice.name]}。`)
      }
      app.emit('adventure/check', session, hints)
      await sendEscaped(session, hints.join('\n'))
      return applyChoice(choice)
    }

    session._skipCurrent = false
    const behavior = fallback && fallback.order !== null ? `将自动选择${fallback.name}` : '默认随机选择'
    const template = options.template || `请输入选项对应的字母继续游戏。若 2 分钟内未选择，则${behavior}。\n{{ choices }}`
    await sendEscaped(session, interpolate(template, { choices: output }), 0)

    const { predecessors } = app.getSessionState(session)
    predecessors[HOOK_PENDING_CHOOSE] = null

    return new Promise((resolve) => {
      // 超时行为
      const timer = setTimeout(() => {
        logger.debug('%s choose timeout', session.userId)
        _resolve(applyChoice(fallback ?? Random.pick(choices)))
      }, 120000)

      // 使用物品进入隐藏分支
      const disposeListener = app.on('adventure/use', (userId, progress) => {
        if (userId !== user.id) return
        _resolve(progress)
      })

      // 正常选择
      const disposeMiddleware = session.middleware((session, next) => {
        const choice = choiceMap[session.content.trim().toUpperCase()]
        if (!choice) return next()
        logger.debug('%s choose %c', session.userId, choice.name)
        _resolve(applyChoice(choice))
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

  export const useItem = (items: Dict<Adventurer.Infer<string>>, options: UseOptions = {}): Action => async (session, state) => {
    const { user, app } = session
    const { onTimeout = '' } = options

    if (checkTimer('$use', user)) {
      logger.debug('%s use disabled', session.userId)
      return Adventurer.getValue(items[''], user, state)
    }

    // drunk: use random item
    if (checkTimer('$drunk', user)) {
      const nextMap: Dict<string> = {}
      for (const name in items) {
        if (name && !user.warehouse[name]) continue
        const next = Adventurer.getValue(items[name], user, state)
        if (next) nextMap[name] = next
      }
      const name = Random.pick(Object.keys(nextMap))
      logger.debug('%s use drunk %c', session.userId, name)
      user.drunkAchv += 1
      const hints = [name ? `$s 醉迷恍惚，随手使用了${name}。` : `$s 醉迷恍惚，没有使用任何物品！`]
      app.emit('adventure/check', session, hints)
      await sendEscaped(session, hints.join('\n'))
      return nextMap[name]
    }

    session._skipCurrent = false
    let template = `你现在可以使用特定的物品。若 5 分钟内未使用这些物品之一，`
    template += (onTimeout ? `将自动使用${onTimeout}。` : '将视为放弃使用。')
    if ('' in items) template += '你也可以直接输入“不使用任何物品”跳过这个阶段。'
    await sendEscaped(session, options.template || template, 0)

    const { predecessors } = app.getSessionState(session)
    predecessors[HOOK_PENDING_USE] = null

    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        logger.debug('%s use timeout', session.userId)
        _resolve(Adventurer.getValue(items[onTimeout], user, state))
      }, 300000)

      const disposeListener = app.on('adventure/use', (userId, progress) => {
        if (userId !== user.id) return
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
  export async function print(session: Adventurer.Session, texts: string[], state = {}, canSkip = true) {
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
  export async function dispatch(session: Adventurer.Session, events: Event[] = [], state = {}) {
    session._gains = new Set()

    const hints: string[] = []
    for (const event of events || []) {
      const result = event(session, state)
      if (!session._skipAll) {
        await sendEscaped(session, result)
      } else if (result) {
        hints.push(result)
      }
    }

    const result = Item.checkOverflow(session)
    if (result) hints.push(result)
    session.app.emit('adventure/check', session, hints)
    await sendEscaped(session, hints.join('\n'))
  }

  export const plot: Action = async (session) => {
    const { user } = session

    // resolve phase
    const phase = getPhase(user)
    if (!phase) return logger.warn('phase not found %c', user.progress)

    logger.debug('%s phase %c', session.userId, user.progress)
    const { items, choices, next, prepare = ({ user }) => user } = phase

    const state = prepare(session)
    await print(session, Adventurer.getValue(phase.texts, user, state), state, user.phases.includes(user.progress))
    await dispatch(session, phase.events, state)

    // resolve next phase
    activeUsers.set(user.id, state)
    const action = typeof next === 'function' && next
      || choices && choose(choices, phase)
      || items && useItem(items, phase)
      || (async () => next as string)
    const progress = await action(session, state)
    activeUsers.delete(user.id)

    // save user data
    await setProgress(user, progress)
    if (!user.phases.includes(user.progress)) {
      session._skipCurrent = false
    }

    // handle next phase
    if (progress) return plot(session)
    logger.debug('%s phase finish', session.userId)
  }

  function setState<V>(map: Dict<[V, NodeJS.Timer]>, key: string, value: V) {
    const current = map[key]
    if (current) clearTimeout(current[1])
    const timer = setTimeout(() => this.map.delete(key), Time.hour)
    const entry = map[key] = [value, timer]
    return () => {
      if (map[key] !== entry) return
      clearTimeout(entry[1])
      delete map[key]
    }
  }

  export async function start(session: Adventurer.Session) {
    const disposeUser = setState(userSessionMap, session.user.id, session)
    const disposeChannel = setState(channelUserMap, session.cid, session.user.id)
    try {
      await plot(session)
    } catch (error) {
      new Logger('cosmos').warn(error)
    }
    disposeUser()
    disposeChannel()
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
    ctx.command('adv/ending [name]', '查看结局', { maxUsage: 100, usageName: 'show' })
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

        const { endings } = session.user
        const storyMap: Dict<string[]> = {}
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

          const prefix = reversedLineMap[name]
          const titles = storyMap[prefix]
          if (!titles) return options['pass'] ? next().then(() => '') : `你尚未解锁剧情「${name}」。`
          const output = titles.map((name) => {
            const id = reversedEndingMap[name]
            return `${id.slice(prefix.length + 1)}. ${name}×${endings[id]}${badEndings.has(id) ? `（BE）` : ''}`
          }).sort()
          const [title, count] = lines[prefix]
          output.unshift(`${session.username}，你已达成${title}的 ${titles.length}/${count} 个结局：`)
          return output.join('\n')
        }

        const output = Object.keys(storyMap).filter(key => lines[key]).sort().map((key) => {
          const { length } = storyMap[key]
          let output = `${lines[key][0]} (${length}/${lines[key][1]})`
          if (length) output += '：' + storyMap[key].join('，')
          return output
        })
        const totalCount = Object.keys(endingMap).length
        const totalBadCount = badEndings.size
        const userCount = Object.keys(endings).length
        const userBadCount = getBadEndingCount(session.user)
        output.unshift(`${session.username}，你已达成 ${userCount}/${totalCount} 个结局（BE: ${userBadCount}/${totalBadCount}）。`)
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

    ctx.command('adv/continue', '继续剧情', { maxUsage: 10 })
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
        if (!session.user.progress) return

        const message = checkStates(session)
        if (message) return message

        return start(session)
      })

    ctx.command('adv/skip [-- command:text]', '跳过剧情')
      .shortcut('跳过剧情')
      .shortcut('跳过当前剧情')
      .userFields(['phases', 'progress', 'id'])
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
        if (!(session = userSessionMap[session.user.id]?.[0])) return
        if (session._skipCurrent || !session._canSkip) return
        session.cancelQueued()
        session._skipCurrent = true
      })

    ctx.command('adv/use [item]', '使用物品', { maxUsage: 100 })
      .userFields(['progress'])
      .userFields(Adventurer.fields)
      .shortcut('使用', { fuzzy: true })
      .shortcut('不使用物品', { options: { nothing: true } })
      .shortcut('不使用任何物品', { options: { nothing: true } })
      .option('nothing', '-n  不使用任何物品，直接进入下一剧情')
      .checkTimer('$system')
      .checkTimer('$use', ({ options }) => !options.nothing)
      .action(async (argv, item) => {
        const { options, session } = argv
        const { user } = session
        const message = checkStates(session, true)
        if (message) return message

        if (!item && !options.nothing) return '请输入物品名。'
        if (item && !Item.data[item]) return Item.suggest(argv)

        const possess = Item.data.map(i => i.name).filter(name => user.warehouse[name])
        const result = ctx.bail('adventure/before-use', item, session)
        if (result) return result

        const phase = getPhase(user)
        if (!phase) return

        const usable = new Set(possess)
        phase.beforeUse?.(session, usable)
        if (options.nothing) item = ''
        if (item && !usable.has(item)) {
          if (session._skipAll) return
          return `你暂未持有物品“${item}”。`
        }

        const state = activeUsers.get(user.id)
        const progress = Adventurer.getValue(phase.items[item], user, state)
        if (progress) {
          logger.debug('%s use %c', session.user.id, item)
          if (activeUsers.has(session.user.id)) {
            await ctx.parallel('adventure/use', session.user.id, progress)
            return
          }

          user['_skip'] = session._skipAll
          await setProgress(user, progress)
          return start(session)
        } else {
          if (!item || session._skipAll) return
          const next = !userSessionMap[session.user.id] && Adventurer.getValue(mainEntry.items[item], user, state)
          if (next) {
            return `物品“${item}”当前不可用，请尝试输入“继续当前剧情”。`
          } else {
            return `物品“${item}”不可用。`
          }
        }
      })

    ctx.on('connect', async () => {
      const data = await ctx.database.mysql.query<Pick<User, 'id' | 'flag' | 'endings'>[]>('select id, flag, endings from user where json_length(endings)')
      for (const { id, flag, endings } of data) {
        if (flag & User.Flag.noLeading) continue
        for (const name in endings) {
          (endingCount[name] ||= new Set()).add(id)
        }
      }
    })
  }
}

export default Phase
