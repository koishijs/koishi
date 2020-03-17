import { Context } from 'koishi-core'
import { TeachConfig, TeachArgv } from './utils'
import internal from './internal'
import receiver from './receiver'
import search from './search'
import shortcut from './shortcut'
import teach from './teach'
import update from './update'
import context from './plugins/context'
import freeze from './plugins/freeze'
import throttle from './plugins/throttle'
import preventLoop from './plugins/preventLoop'
import successor from './plugins/successor'
import writer from './plugins/writer'

export * from './database'
export * from './receiver'
export * from './search'
export * from './utils'
export * from './plugins/context'
export * from './plugins/freeze'
export * from './plugins/throttle'
export * from './plugins/preventLoop'
export * from './plugins/successor'
export * from './plugins/writer'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/validate' (argv: TeachArgv): any
    'dialogue/execute' (argv: TeachArgv): any
  }
}

export const name = 'teach'

export function apply (ctx: Context, config: TeachConfig = {}) {
  ctx.command('teach', '添加教学对话', { authority: 2, checkUnknown: true })
    .action(async ({ options, meta, args }) => {
      const argv: TeachArgv = { ctx, meta, args, config, options }
      return ctx.bail('dialogue/validate', argv)
        || ctx.bail('dialogue/execute', argv)
    })

  // features
  ctx.plugin(shortcut, config)
  ctx.plugin(receiver, config)
  ctx.plugin(search, config)
  ctx.plugin(update, config)
  ctx.plugin(teach, config)

  // options
  ctx.plugin(internal, config)
  ctx.plugin(context, config)
  ctx.plugin(freeze, config)
  ctx.plugin(throttle, config)
  ctx.plugin(preventLoop, config)
  ctx.plugin(successor, config)
  ctx.plugin(writer, config)
}
