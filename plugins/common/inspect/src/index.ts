import { Context, h, Schema } from 'koishi'

export const name = 'inspect'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))

  ctx.command('inspect')
    .action(({ session }, target) => {
      if (session.quote) {
        return session.text('.message', {
          ...session.quote,
          selfId: session.selfId,
        })
      }

      if (target) {
        const { type, attrs } = h.parse(target)[0]
        if (type === 'at') {
          return session.text('.user', attrs)
        } else if (type === 'sharp') {
          return session.text('.channel', attrs)
        } else {
          return session.text('.invalid')
        }
      }

      return session.text('.message', session)
    })
}
