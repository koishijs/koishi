import { Context } from 'koishi-core'
import { DebugOptions } from './debug'
import repeater, { RepeaterOptions } from './repeater'
import handler, { HandlerOptions } from './handler'

export * from './admin'
export * from './broadcast'
export * from './info'
export * from './repeater'

export interface Options extends HandlerOptions, RepeaterOptions {
  admin?: false
  broadcast?: false
  contextify?: false
  echo?: false
  info?: false
  usage?: false
  debug?: DebugOptions
}

export const name = 'common'

export function apply(ctx: Context, options: Options = {}) {
  ctx.plugin(handler, options)
  ctx.plugin(repeater, options)

  if (options.echo !== false) ctx.plugin(require('./echo'))
  if (options.admin !== false) ctx.plugin(require('./admin'))
  if (options.contextify !== false) ctx.plugin(require('./contextify'))
  if (options.broadcast !== false) ctx.plugin(require('./broadcast'))
  if (options.debug) ctx.plugin(require('./debug'), options.debug)
  if (options.info !== false) ctx.plugin(require('./info'))
  if (options.usage !== false) ctx.plugin(require('./usage'))
}
