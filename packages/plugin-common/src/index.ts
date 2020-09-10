import { Context } from 'koishi-core'
import { DebugOptions } from './debug'
import repeater, { RepeaterOptions } from './repeater'
import handler, { HandlerOptions } from './handler'
import sender from './sender'

export * from './admin'
export * from './info'
export * from './repeater'

export interface Config extends HandlerOptions, RepeaterOptions {
  admin?: false
  broadcast?: false
  echo?: false
  info?: false
  debug?: DebugOptions
}

export const name = 'common'

export function apply(ctx: Context, config: Config = {}) {
  ctx.plugin(handler, config)
  ctx.plugin(repeater, config)
  ctx.plugin(sender, config)

  if (config.admin !== false) ctx.plugin(require('./admin'))
  if (config.debug) ctx.plugin(require('./debug'), config.debug)
  if (config.info !== false) ctx.plugin(require('./info'))
}
