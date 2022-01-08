import { Context, Schema } from 'koishi'
import basic, { BasicConfig } from './basic'

export * from './basic'

export const name = 'common'

export interface Config extends BasicConfig {}

export const Config = Schema.object({
  contextify: Schema.boolean().description('启用 contextify 指令。').default(true),
})

export function apply(ctx: Context, config: Config) {
  ctx.command('common', '基础功能')

  ctx.plugin(basic, config)
}
