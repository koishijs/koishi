import { Context } from 'koishi-core'
import {} from 'koishi-plugin-webui'

export const name = 'chat'

export function apply(ctx: Context) {
  ctx.with('koishi-plugin-webui', () => {})
}
