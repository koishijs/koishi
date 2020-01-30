import { ParsedTeachLine } from './utils'

export default async function apply ({ groups, reversed, partial, ctx, meta }: ParsedTeachLine) {
  const { questions, answers } = await ctx.database.getDialogueCount({ groups, reversed, partial })
  return meta.$send(`共收录了 ${questions} 个问题和 ${answers} 个回答。`)
}
