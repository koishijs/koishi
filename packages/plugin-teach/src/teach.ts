import { Dialogue, prepareTargets, sendResult } from './database'
import { Context } from 'koishi-core'

async function teach (argv: Dialogue.Argv) {
  const { ctx, options } = argv
  options.create = true
  const { question, answer } = options
  if (await ctx.app.serialize('dialogue/before-modify', argv)) return

  argv.unknown = []
  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
  argv.dialogues = await Dialogue.fromTest(ctx, { question, answer, regexp: false })

  if (argv.dialogues.length) {
    argv.target = argv.dialogues.map(d => d.id)
    const targets = prepareTargets(argv)
    for (const dialogue of targets) {
      ctx.emit('dialogue/modify', argv, dialogue)
    }
    await Dialogue.update(targets, argv)
    await ctx.serialize('dialogue/after-modify', argv)
    return sendResult(argv)
  }

  const dialogue = { flag: 0 } as Dialogue
  if (ctx.bail('dialogue/permit', argv, dialogue)) {
    return argv.meta.$send('权限不足。')
  }

  try {
    ctx.emit('dialogue/modify', argv, dialogue)
    argv.dialogues = [await Dialogue.create(dialogue, argv)]

    await ctx.serialize('dialogue/after-modify', argv)
    return sendResult(argv, `问答已添加，编号为 ${argv.dialogues[0].id}。`)
  } catch (err) {
    await argv.meta.$send('添加问答时遇到错误。')
    throw err
  }
}

export default function apply (ctx: Context) {
  ctx.on('dialogue/execute', async (argv) => {
    try {
      return teach(argv)
    } catch (err) {
      ctx.logger('teach').warn(err)
      return argv.meta.$send(`添加问答时出现问题。`)
    }
  })
}
