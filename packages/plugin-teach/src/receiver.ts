import { Context, UserField, getSenderName, Meta, NextFunction } from 'koishi-core'
import { CQCode, sleep, isInteger, simplify } from 'koishi-utils'
import { getDialogues, TeachConfig } from './utils'
import { Dialogue, DialogueTest, DialogueFlag, AppellationType } from './database'
import escapeRegex from 'escape-string-regexp'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/state' (state: SessionState): void
    'dialogue/receive' (meta: Meta<'message'>, test: DialogueTest, state: SessionState): void | boolean
    'dialogue/before-attach-user' (meta: Meta<'message'>, userFields: Set<UserField>): void
    'dialogue/attach-user' (meta: Meta<'message'>, dialogues: Dialogue[]): void | boolean
    'dialogue/before-send' (meta: Meta<'message'>, dialogue: Dialogue, state: SessionState): void | boolean
    'dialogue/send' (meta: Meta<'message'>, dialogue: Dialogue, state: SessionState): void
    'dialogue/after-send' (meta: Meta<'message'>, dialogue: Dialogue, state: SessionState): void
  }
}

declare module 'koishi-core/dist/meta' {
  interface Meta {
    $_redirected?: number
  }
}

declare module './utils' {
  interface TeachConfig {
    nickname?: string | string[]
    appellationTimeout?: number
    maxRedirections?: number
    _stripQuestion? (source: string): [string, AppellationType]
  }
}

declare module './database' {
  interface DialogueTest {
    redirect?: boolean
  }
}

export interface SessionState {
  activated: Record<number, number>
}

const states: Record<number, SessionState> = {}

function escapeAnswer (message: string) {
  return message.replace(/\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
}

function unescapeAnswer (message: string) {
  return message.trim().replace(/@@__DOLLARS_PLACEHOLDER__@@/g, '$')
}

export async function triggerDialogue (ctx: Context, meta: Meta<'message'>, config: TeachConfig, next: NextFunction) {
  const { groupId } = meta
  const { appellationTimeout = 20000 } = config

  if (!states[groupId]) {
    ctx.emit('dialogue/state', states[groupId] = { activated: {} } as SessionState)
  }
  const state = states[groupId]
  const test: DialogueTest = {}

  if (ctx.bail('dialogue/receive', meta, test, state)) return next()

  // fetch matched dialogues
  const uid = meta.anonymous ? -meta.anonymous.id : meta.userId
  const dialogues = await getDialogues(ctx, test, state)
  const isActivated = uid in state.activated
  dialogues.forEach((dialogue) => {
    dialogue._prob = isActivated
      ? Math.max(dialogue.probS, dialogue.probA)
      : test.appellative === AppellationType.appellative
        ? dialogue.probA
        : dialogue.probS
  })

  if (dialogues.every(d => !d._prob)) return next()

  // fetch user
  const userFields = new Set<UserField>(['name'])
  ctx.app.emit(meta, 'dialogue/before-attach-user', meta, userFields)
  meta.$user = await ctx.database.observeUser(meta.$user, Array.from(userFields))
  if (ctx.app.bail(meta, 'dialogue/attach-user', meta, dialogues)) return next()

  // pick dialogue
  let dialogue: Dialogue
  const total = dialogues.reduce((prev, curr) => prev + curr._prob, 0)
  const target = Math.random() * Math.max(1, total)
  let pointer = 0
  for (const _dialogue of dialogues) {
    pointer += _dialogue._prob
    if (target < pointer) {
      dialogue = _dialogue
      break
    }
  }
  if (!dialogue) return next()

  // parse answer
  const answer = dialogue.answer
    .replace(/\$\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
    .replace(/\$A/g, CQCode.stringify('at', { qq: 'all' }))
    .replace(/\$a/g, CQCode.stringify('at', { qq: meta.userId }))
    .replace(/\$m/g, CQCode.stringify('at', { qq: meta.selfId }))
    .replace(/\$s/g, escapeAnswer(getSenderName(meta)))
    .replace(/\$0/g, escapeAnswer(meta.message))

  // redirect dialogue to command execution
  if (dialogue.flag & DialogueFlag.redirect) {
    Object.defineProperty(meta, '$_redirected', {
      writable: true,
      value: (meta.$_redirected || 0) + 1,
    })
    ctx.logger('dialogue').debug(meta.message, '=>', dialogue.answer)
    return ctx.app.executeCommandLine(unescapeAnswer(answer), meta, next)
  }

  ctx.logger('dialogue').debug(meta.message, '->', dialogue.answer)
  if (ctx.app.bail(meta, 'dialogue/before-send', meta, dialogue, state)) return next()
  await ctx.app.parallelize(meta, 'dialogue/send', meta, dialogue, state)

  // send answers
  const answers = answer.split('$n').map(unescapeAnswer)

  for (const answer of answers) {
    await sleep(answer.length * 50)
    await meta.$send(answer)
  }

  if (test.appellative === AppellationType.activated) {
    const time = state.activated[uid] = Date.now()

    setTimeout(() => {
      if (state.activated[uid] === time) {
        delete state.activated[uid]
      }
    }, appellationTimeout)
  }

  await ctx.app.parallelize(meta, 'dialogue/after-send', meta, dialogue, state)
}

export default function (ctx: Context, config: TeachConfig) {
  const { maxRedirections = 3, nickname = ctx.app.options.nickname } = config
  const nicknames = Array.isArray(nickname) ? nickname : nickname ? [nickname] : []
  nicknames.push(`[cq:at,qq=${ctx.app.selfId}]`)
  const nicknameRE = new RegExp(`^((${nicknames.map(escapeRegex).join('|')})[,，]?\\s*)+`)

  config._stripQuestion = (source) => {
    source = simplify(stripPunctuation(String(source || '')))
    const original = source
    const capture = nicknameRE.exec(source)
    if (capture) source = source.slice(capture[0].length)
    return [
      source || original,
      source === original
        ? AppellationType.normal
        : source
          ? AppellationType.appellative
          : AppellationType.activated,
    ]
  }

  ctx.command('dialogue <message...>', '触发教学对话')
    .option('-g, --group [id]', '设置要触发问答的群号')
    .action(async ({ meta, options, next }, message) => {
      if (meta.$_redirected > maxRedirections) return next()

      if (options.group !== undefined) {
        if (!isInteger(options.group) || options.group <= 0) {
          return meta.$send('选项 -g, --group 应为正整数。')
        }
        meta.groupId = options.group
      }

      if (meta.messageType !== 'group' && !options.group) {
        return meta.$send('请输入要触发问答的群号。')
      }

      meta.message = message
      return triggerDialogue(ctx, meta, config, next)
    })

  ctx.intersect(ctx.app.groups).middleware(async (meta, next) => {
    return triggerDialogue(ctx, meta, config, next)
  })
}

const prefixPunctuation = /^([()\]]|\[(?!cq:))*/
const suffixPunctuation = /([.,?!()[~]|(?<!\[cq:[^\]]+)\])*$/

function stripPunctuation (source: string) {
  source = source.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/，/g, ',')
    .replace(/、/g, ',')
    .replace(/。/g, '.')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/～/g, '~')
  return source
    .replace(prefixPunctuation, '')
    .replace(suffixPunctuation, '') || source
}
