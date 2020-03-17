import { DialogueFlag, Dialogue } from './database'
import { TeachArgv, modifyDialogue, checkAuthority, getDialogues, sendResult } from './utils'
import { observe } from 'koishi-utils'

export default async function (argv: TeachArgv) {
  const { meta, ctx, options } = argv

  const {
    answer,
    question,
    original,
    probability = 1,
  } = options

  if (!question || !answer) return meta.$send('缺少问题或回答，请检查指令语法。')

  if (await ctx.app.serialize('dialogue/before-modify', argv)) return

  argv.unknown = []
  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
  argv.failed = []
  argv.dialogues = await getDialogues(ctx, { question, answer })

  if (argv.dialogues.length) {
    const [data] = argv.dialogues
    const dialogue = observe(data, diff => ctx.database.setDialogue(data.id, diff), `dialogue ${data.id}`)
    modifyDialogue(dialogue, argv)
    await ctx.serialize('dialogue/after-modify', argv)
    if (Object.keys(dialogue._diff).length) {
      checkAuthority(argv, [data])
      if (argv.uneditable[0] === data.id) {
        argv.uneditable.shift()
        return sendResult(argv, `问答已存在，编号为 ${data.id}，且因权限过低无法修改。`)
      }
      await dialogue._update()
      return sendResult(argv, `修改了已存在的问答，编号为 ${data.id}。`)
    } else {
      return sendResult(argv, `问答已存在，编号为 ${data.id}，如要修改请尝试使用 #${data.id} 指令。`)
    }
  }

  const flag = ~~options.keyword * DialogueFlag.keyword

  const dialogue = {
    question,
    answer,
    flag,
    probability,
    original,
  } as Dialogue

  ctx.emit('dialogue/modify', argv, dialogue)
  argv.dialogues = [await ctx.database.createDialogue(dialogue)]
  await ctx.serialize('dialogue/after-modify', argv)
  return sendResult(argv, `问答已添加，编号为 ${argv.dialogues[0].id}。`)
}
