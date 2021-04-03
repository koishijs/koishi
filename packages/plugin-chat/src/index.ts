import { Context } from 'koishi-core'
import {} from 'koishi-plugin-webui'
import { resolve } from 'path'
import debug, { DebugConfig } from './debug'

export interface Config extends DebugConfig {}

export const name = 'chat'

export function apply(ctx: Context, options: Config = {}) {
  ctx.plugin(debug, options)
  ctx.with(['koishi-plugin-webui'], () => {
    const filename = ctx.webui.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.webui.addEntry(resolve(__dirname, filename))
  })
}
