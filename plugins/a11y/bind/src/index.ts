import { Context, Dict, Random, Schema, Session, Time, User } from 'koishi'

export interface Config {
  generateToken?: () => string
}

export const name = 'bind'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({
  generateToken: Schema.function().hidden(),
})

export function apply(ctx: Context, config: Config = {}) {
  ctx.i18n.define('zh', require('../i18n/zh'))
  ctx.i18n.define('en', require('../i18n/en'))

  // 1: group (1st step)
  // 0: private
  // -1: group (2nd step)
  type TokenData = [platform: string, id: string, pending: number]
  const tokens: Dict<TokenData> = {}

  const { generateToken = () => 'koishi/' + Random.id(6, 10) } = config

  function generate(session: Session, pending: number) {
    const token = generateToken()
    tokens[token] = [session.platform, session.userId, pending]
    setTimeout(() => delete tokens[token], 5 * Time.minute)
    return token
  }

  async function bind(user: User.Observed<never>, platform: string, userId: string) {
    await ctx.database.remove('user', { [platform]: [userId] })
    user[platform] = userId as never
    await user.$update()
  }

  ctx.command('bind', '绑定到账号', { authority: 0 })
    .action(({ session }) => {
      const token = generate(session, +(session.subtype === 'group'))
      return session.text('bind.generated-1', [token])
    })

  ctx.middleware(async (session, next) => {
    const data = tokens[session.content]
    if (!data) return next()
    if (data[2] < 0) {
      const sess = new Session(session.bot, { ...session, platform: data[0], userId: data[1] })
      const user = await sess.observeUser([session.platform as never])
      delete tokens[session.content]
      await bind(user, session.platform, session.userId)
      return session.text('bind.success')
    } else {
      const user = await session.observeUser(['authority', data[0] as never])
      if (!user.authority) return session.text('internal.low-authority')
      if (user[data[0]]) return session.text('bind.failed')
      delete tokens[session.content]
      if (data[2]) {
        const token = generate(session, -1)
        return session.text('bind.generated-2', [token])
      } else {
        await bind(user, data[0], data[1])
        return session.text('bind.success')
      }
    }
  }, true)
}
