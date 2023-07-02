import { Context, h, RuntimeError, Schema, Session } from 'koishi'
import zhCN from './locales/zh-CN.yml'

declare module 'koishi' {
  interface Events {
    'common/callme'(name: string, session: Session): string | void
  }
}

export interface Config {}

export const name = 'callme'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.i18n.define('zh-CN', zhCN)

  ctx.command('callme [name:text]')
    .userFields(['id', 'name'])
    .alias('nn')
    .shortcut('叫我', { prefix: true, fuzzy: true })
    .action(async ({ session }, name) => {
      const { user } = session
      if (!name) {
        if (user.name) {
          return session.text('.current', [session.username])
        } else {
          return session.text('.unnamed')
        }
      }

      name = h.transform(name, {
        text: true,
        default: false,
      }).trim()

      if (name === user.name) {
        return session.text('.unchanged')
      } else if (!name) {
        return session.text('.empty')
      }

      const result = ctx.bail('common/callme', name, session)
      if (result) return result

      try {
        user.name = name
        await user.$update()
        return session.text('.updated', [session.username])
      } catch (error) {
        if (RuntimeError.check(error, 'duplicate-entry')) {
          return session.text('.duplicate')
        } else {
          ctx.logger('common').warn(error)
          return session.text('.failed')
        }
      }
    })
}
