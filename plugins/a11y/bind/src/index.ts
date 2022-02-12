import { Context, Dict, Random, Schema, Session, template, Time, User } from 'koishi'

template.set('bind', {
  'generated-1': [
    'bind 指令可用于在多个平台间绑定用户数据。绑定过程中，源平台的用户数据将完全保留，而目标平台的用户数据将被源平台的数据所覆盖。',
    '请确认当前平台是你的目标平台，并在 5 分钟内使用你的账号在源平台内向机器人发送以下文本：',
    '{0}',
    '注意：每个账号只能绑定到每个平台一次，此操作将会抹去你当前平台上的数据，请谨慎操作！',
  ].join('\n'),
  'generated-2': [
    '令牌核验成功！下面将进行第二步操作。',
    '请在 5 分钟内使用你的账号在目标平台内向机器人发送以下文本：',
    '{0}',
    '注意：当前平台是你的源平台，这里的用户数据将完全保留，而目标平台的用户数据将被覆盖，请谨慎操作！',
  ].join('\n'),
  'failed': '账号绑定失败：你已经绑定过该平台。',
  'success': '账号绑定成功！',
})

export interface Config {
  generateToken?: () => string
}

export const name = 'bind'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({
  generateToken: Schema.function().hidden(),
})

export function apply(ctx: Context, config: Config = {}) {
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
      return template('bind.generated-1', token)
    })

  ctx.middleware(async (session, next) => {
    const data = tokens[session.content]
    if (!data) return next()
    if (data[2] < 0) {
      const sess = new Session(session.bot, { ...session, platform: data[0], userId: data[1] })
      const user = await sess.observeUser([session.platform as never])
      delete tokens[session.content]
      await bind(user, session.platform, session.userId)
      return template('bind.success')
    } else {
      const user = await session.observeUser(['authority', data[0] as never])
      if (!user.authority) return template('internal.low-authority')
      if (user[data[0]]) return template('bind.failed')
      delete tokens[session.content]
      if (data[2]) {
        const token = generate(session, -1)
        return template('bind.generated-2', token)
      } else {
        await bind(user, data[0], data[1])
        return template('bind.success')
      }
    }
  }, true)
}
