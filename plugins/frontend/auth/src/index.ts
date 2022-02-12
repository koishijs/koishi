import { Context, Schema } from 'koishi'
import {} from '@koishijs/plugin-console'
import { resolve } from 'path'

export interface Config {}

export const name = 'auth'
export const using = ['console'] as const
export const schema: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  if (ctx.console.config.devMode) {
    ctx.console.addEntry(resolve(__dirname, '../client/index.ts'))
  } else {
    ctx.console.addEntry(resolve(__dirname, '../dist'))
  }
}
