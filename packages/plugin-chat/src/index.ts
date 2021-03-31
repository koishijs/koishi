import { Context } from 'koishi-core'
import {} from 'koishi-plugin-webui'
import { resolve } from 'path'
import debug, { DebugConfig } from './debug'

export interface Config extends DebugConfig {}

export const name = 'chat'

export function apply(ctx: Context, options: Config = {}) {
  ctx.plugin(debug, options)
  ctx.with('koishi-plugin-webui', () => {
    const { config, entries } = ctx.webui

    const filename = resolve(__dirname, config.devMode ? '../client/index.ts' : '../dist/index.js')
    entries.chat = filename
    ctx.before('disconnect', () => {
      delete entries.chat
    })
  })
}
