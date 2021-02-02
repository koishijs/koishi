import { Context } from 'koishi-core'
import { DebugOptions } from './debug'
import repeater, { RepeaterOptions } from './repeater'
import handler, { HandlerOptions } from './handler'
import sender, { SenderConfig } from './sender'
import { AdminConfig } from './admin'

export * from './admin'
export * from './repeater'

export interface Config extends AdminConfig, HandlerOptions, RepeaterOptions, SenderConfig {
  debug?: DebugOptions
}

export const name = 'common'

export function apply(ctx: Context, config: Config = {}) {
  ctx.command('common', '基础功能')

  ctx.plugin(handler, config)
  ctx.plugin(repeater, config)
  ctx.plugin(sender, config)

  ctx.select('database').plugin(require('./admin'), config)

  if (config.debug) {
    ctx.plugin(require('./debug'), config.debug)
  }
}
