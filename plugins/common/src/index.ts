import { Context, Schema } from 'koishi'
import basic, { BasicConfig } from './basic'
import handler, { HandlerConfig } from './handler'
import updater, { UpdaterConfig } from './updater'

export * from './basic'
export * from './handler'
export * from './updater'

declare module 'koishi' {
  interface Module {
    common: typeof import('.')
  }
}

export interface Config extends HandlerConfig, BasicConfig, UpdaterConfig {}

export const name = 'common'

export const schema: Schema<Config> = Schema.object({
  echo: Schema.boolean('启用 echo 指令。').default(true),
  broadcast: Schema.boolean('启用 broadcast 指令。').default(true),
  contextify: Schema.boolean('启用 contextify 指令。').default(true),
})

export const delegates: Context.Delegates.Meta = {
  optional: ['database'],
}

export function apply(ctx: Context, config: Config = {}) {
  ctx.command('common', '基础功能')

  ctx.plugin(basic, config)
  ctx.plugin(handler, config)
  ctx.plugin(updater, config)
}
