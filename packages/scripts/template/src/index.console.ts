import { Context } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'

export const name = '{{name}}'

export function apply(ctx: Context) {
  ctx.using(['console'], (ctx) => {
    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })
  })
}
