import { TeachOptions } from './utils'

export default async function apply (config: TeachOptions) {
  if (config.options.info) {
    let { envMode, groups, ctx, meta, options } = config
    if (!envMode && !options.allEnv) {
      envMode = 1
      groups = [meta.groupId]
    }
    const { questions, answers } = await ctx.database.getDialogueCount({ envMode, groups })
    return meta.$send(`共收录了 ${questions} 个问题和 ${answers} 个回答。`)
  }
}
