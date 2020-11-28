import { Context } from 'koishi-core'
import { DebugOptions } from './debug'
import repeater, { RepeaterOptions } from './repeater'
import handler, { HandlerOptions } from './handler'
import sender, { SenderConfig } from './sender'

export * from './admin'
export * from './info'
export * from './repeater'

export interface Config extends HandlerOptions, RepeaterOptions, SenderConfig {
  debug?: DebugOptions
}

export const name = 'common'

export function apply(ctx: Context, config: Config = {}) {
  ctx.command('common', '基础功能')

  ctx.plugin(handler, config)
  ctx.plugin(repeater, config)
  ctx.plugin(sender, config)

  ctx.plugin(require('./admin'))
  ctx.plugin(require('./info'))

  if (config.debug) {
    ctx.plugin(require('./debug'), config.debug)
  }
}
