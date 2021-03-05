import { Context } from 'koishi-core'
import admin, { AdminConfig } from './admin'
import debug, { DebugOptions } from './debug'
import handler, { HandlerOptions } from './handler'
import repeater, { RepeaterOptions } from './repeater'
import sender, { SenderConfig } from './sender'

export { admin, debug, handler, repeater, sender }

export interface Config extends AdminConfig, HandlerOptions, RepeaterOptions, SenderConfig {
  debug?: DebugOptions
}

export const name = 'common'

export function apply(ctx: Context, config: Config = {}) {
  ctx.command('common', '基础功能')

  ctx.plugin(admin, config)
  ctx.plugin(handler, config)
  ctx.plugin(repeater, config)
  ctx.plugin(sender, config)

  if (config.debug) {
    ctx.plugin(debug, config.debug)
  }
}
