import { Context, getSenderName, Meta } from 'koishi-core'
import { randomPick, CQCode, sleep } from 'koishi-utils'
import { simplifyQuestion, TeachConfig, DialogueTest, Dialogue } from './utils'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue' (meta: Meta, dialogue: Dialogue): any
    'after-dialogue' (meta: Meta, dialogue: Dialogue): any
  }
}

function escapeAnswer (message: string) {
  return message.replace(/\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
}

export default function (ctx: Context, config: TeachConfig) {
  ctx.intersect(ctx.app.groups).middleware(async (meta, next) => {
    const { groupId } = meta
    const question = simplifyQuestion(meta.message)
    if (!question) return next()

    const test: DialogueTest = { question }
    if (config.useEnvironment) {
      test.partial = true
      test.reversed = false
      test.groups = [groupId]
    }

    const items = await ctx.database.getDialogues(test)
    if (!items.length) return next()

    const dialogue = randomPick(items)
    if (!dialogue || dialogue.probability < 1 && dialogue.probability <= Math.random()) return next()

    ctx.app.emitEvent(meta, 'dialogue', meta, dialogue)

    const answers = dialogue.answer
      .replace(/\$\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
      .replace(/\$a/g, `[CQ:at,qq=${meta.userId}]`)
      .replace(/\$A/g, '[CQ:at,qq=all]')
      .replace(/\$m/g, CQCode.stringify('at', { qq: meta.selfId }))
      .replace(/\$s/g, escapeAnswer(getSenderName(meta)))
      .replace(/\$0/g, escapeAnswer(meta.message))
      .split('$n')
      .map(str => str.trim().replace(/@@__DOLLARS_PLACEHOLDER__@@/g, '$'))

    for (const answer of answers) {
      await sleep(answer.length * 50)
      await meta.$send(answer)
    }

    ctx.app.emitEvent(meta, 'after-dialogue', meta, dialogue)
  })
}
