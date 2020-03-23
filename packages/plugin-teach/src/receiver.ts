import { Context, UserField, getSenderName, Meta, NextFunction } from 'koishi-core'
import { CQCode, sleep, isInteger } from 'koishi-utils'
import { getDialogues, TeachConfig } from './utils'
import { Dialogue, DialogueTest, DialogueFlag } from './database'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/state' (state: SessionState): void
    'dialogue/receive' (meta: Meta<'message'>, test: DialogueTest, state: SessionState): void | boolean
    'dialogue/before-attach-user' (meta: Meta<'message'>, userFields: Set<UserField>): void
    'dialogue/attach-user' (meta: Meta<'message'>): boolean
    'dialogue/before-send' (meta: Meta<'message'>, dialogue: Dialogue, state: SessionState): boolean
    'dialogue/send' (meta: Meta<'message'>, dialogue: Dialogue, state: SessionState): void
    'dialogue/after-send' (meta: Meta<'message'>, dialogue: Dialogue, state: SessionState): void
  }
}

declare module 'koishi-core/dist/meta' {
  interface Meta {
    $dialogues?: Dialogue[]
    $_redirected?: number
  }
}

declare module './utils' {
  interface TeachConfig {
    maxRedirections?: number
  }
}

declare module './database' {
  interface DialogueTest {
    redirect?: boolean
  }
}

export interface SessionState {}

const states: Record<number, SessionState> = {}

function escapeAnswer (message: string) {
  return message.replace(/\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
}

function unescapeAnswer (message: string) {
  return message.trim().replace(/@@__DOLLARS_PLACEHOLDER__@@/g, '$')
}

export async function triggerDialogue (ctx: Context, meta: Meta<'message'>, next: NextFunction) {
  const { groupId } = meta

  if (!states[groupId]) {
    ctx.emit('dialogue/state', states[groupId] = {} as SessionState)
  }
  const state = states[groupId]
  const test: DialogueTest = {}

  if (ctx.bail('dialogue/receive', meta, test, state)) return next()

  // fetch dialogues
  meta.$dialogues = await getDialogues(ctx, test, state)
  if (!meta.$dialogues.length) return next()

  // fetch user
  const userFields = new Set<UserField>(['name'])
  ctx.app.emit(meta, 'dialogue/before-attach-user', meta, userFields)
  meta.$user = await ctx.database.observeUser(meta.$user, Array.from(userFields))
  if (ctx.app.bail(meta, 'dialogue/attach-user', meta)) return next()

  // pick dialogue
  let dialogue: Dialogue
  const total = meta.$dialogues.reduce((prev, curr) => prev + curr.probability, 0)
  const target = Math.random() * Math.max(1, total)
  let pointer = 0
  for (const _dialogue of meta.$dialogues) {
    pointer += _dialogue.probability
    if (target < pointer) {
      dialogue = _dialogue
      break
    }
  }
  if (!dialogue) return next()

  const answer = dialogue.answer
    .replace(/\$\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
    .replace(/\$A/g, CQCode.stringify('at', { qq: 'all' }))
    .replace(/\$a/g, CQCode.stringify('at', { qq: meta.userId }))
    .replace(/\$m/g, CQCode.stringify('at', { qq: meta.selfId }))
    .replace(/\$s/g, escapeAnswer(getSenderName(meta)))
    .replace(/\$0/g, escapeAnswer(meta.message))

  if (dialogue.flag & DialogueFlag.redirect) {
    meta.$_redirected = (meta.$_redirected || 0) + 1
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

  await ctx.app.parallelize(meta, 'dialogue/after-send', meta, dialogue, state)
}

export default function (ctx: Context, { maxRedirections = 3 }: TeachConfig) {
  ctx.command('teach')

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
      return triggerDialogue(ctx, meta, next)
    })

  ctx.intersect(ctx.app.groups).middleware(async (meta, next) => {
    return triggerDialogue(ctx, meta, next)
  })
}
