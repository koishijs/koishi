import { DialogueFlag } from './database'
import { simplifyQuestion, simplifyAnswer, TeachOptions } from './utils'

export default async function (parsedOptions: TeachOptions, question: string, answer: string) {
  const { argc, meta, ctx, options } = parsedOptions
  if (String(question).includes('[CQ:image,')) return meta.$send('问题不能包含图片。')
  question = simplifyQuestion(question)
  answer = simplifyAnswer(answer)

  if (!answer) return meta.$send('缺少问题或回答，请检查指令语法。')
  if (argc > 2) return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')

  const [dialogue] = await ctx.database.getDialogues({ question, answer })
  if (dialogue) {
    return meta.$send(`问答已存在，编号为 ${dialogue.id}，如要修改请尝试使用 -u 指令。`)
  } else {
    let { envMode, groups, writer } = parsedOptions
    if (!envMode) {
      envMode = 2
      groups = [meta.groupId]
    } else if (Math.abs(envMode) === 1) {
      return meta.$send('参数 -e, --env 错误，请检查指令语法。')
    }
    if (writer === undefined) {
      writer = meta.userId
    }
    const { chance: probability = 1 } = options
    const flag = Number(!!options.frozen) * DialogueFlag.frozen
      + Number(!!options.regexp) * DialogueFlag.regexp
    const dialogue = await ctx.database.createDialogue({
      groups: (envMode === 2 ? '' : '*') + groups.join(','),
      question,
      answer,
      writer,
      flag,
      probability,
    })
    return meta.$send(`问答已添加，编号为 ${dialogue.id}。`)
  }
}
