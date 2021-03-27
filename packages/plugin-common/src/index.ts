import { Context } from 'koishi-core'
import admin, { AdminConfig } from './admin'
import basic, { BasicConfig } from './basic'
import handler, { HandlerConfig } from './handler'

export { admin }

export * from './basic'
export * from './handler'

export interface Config extends AdminConfig, HandlerConfig, BasicConfig {}

export const name = 'common'

export function apply(ctx: Context, config: Config = {}) {
  ctx.command('common', '基础功能')

  ctx.plugin(admin, config)
  ctx.plugin(basic, config)
  ctx.plugin(handler, config)
}
