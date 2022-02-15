import { Context, KoishiError, Schema, template } from 'koishi'

declare module 'koishi' {
  interface EventMap {
    'common/callme'(name: string, session: Session): string | void
  }
}

template.set('callme', {
  'current': '好的呢，{0}！',
  'unnamed': '你还没有给自己起一个称呼呢~',
  'unchanged': '称呼未发生变化。',
  'empty': '称呼不能为空。',
  'invalid': '称呼中禁止包含纯文本以外的内容。',
  'duplicate': '禁止与其他用户重名。',
  'updated': '好的，{0}，请多指教！',
  'failed': '修改称呼失败。',
})

export interface Config {}

export const name = 'callme'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.command('callme [name:text]', '修改自己的称呼')
    .userFields(['id', 'name'])
    .shortcut('叫我', { prefix: true, fuzzy: true })
    .action(async ({ session }, name) => {
      const { user } = session
      if (!name) {
        if (user.name) {
          return template('callme.current', session.username)
        } else {
          return template('callme.unnamed')
        }
      } else if (name === user.name) {
        return template('callme.unchanged')
      } else if (!(name = name.trim())) {
        return template('callme.empty')
      } else if (name.includes('[CQ:')) {
        return template('callme.invalid')
      }

      const result = ctx.bail('common/callme', name, session)
      if (result) return result

      try {
        user.name = name
        await user.$update()
        return template('callme.updated', session.username)
      } catch (error) {
        if (KoishiError.check(error, 'database.duplicate-entry')) {
          return template('callme.duplicate')
        } else {
          ctx.logger('common').warn(error)
          return template('callme.failed')
        }
      }
    })
}
