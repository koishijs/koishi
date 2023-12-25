import { Context, Dict, Random, Schema, Session, Time } from 'koishi'
import zhCN from './locales/zh-CN.yml'
import enUS from './locales/en-US.yml'

export interface Config {
  tokenPrefix?: string
  generateToken?: () => string
}

export const name = 'bind'
export const inject = ['database']
export const Config: Schema<Config> = Schema.object({
  generateToken: Schema.function().hidden(),
})

export function apply(ctx: Context, config: Config = {}) {
  ctx.i18n.define('zh-CN', zhCN)
  ctx.i18n.define('en-US', enUS)

  // 1: group (1st step)
  // 0: private
  // -1: group (2nd step)
  type TokenData = [platform: string, id: string, phase: number]
  const tokens: Dict<TokenData> = Object.create(null)

  const { tokenPrefix: prefix = 'koishi/' } = config
  const { generateToken = () => `${prefix}` + Random.id(6, 10) } = config

  function generate(session: Session, phase: number) {
    const token = generateToken()
    tokens[token] = [session.platform, session.userId, phase]
    ctx.setTimeout(() => delete tokens[token], 5 * Time.minute)
    return token
  }

  async function bind(aid: number, platform: string, pid: string) {
    await ctx.database.set('binding', { platform, pid }, { aid })
  }

  ctx.command('bind', { authority: 0 })
    .userFields(['id'])
    .option('remove', '-r')
    .action(async ({ session, options }) => {
      if (options.remove) {
        const { platform, userId: pid } = session
        const bindings = await ctx.database.get('binding', { aid: session.user.id })
        const binding = bindings.find(item => item.platform === platform && item.pid === pid)
        if (binding.aid !== binding.bid) {
          // restore the original binding
          await bind(binding.bid, platform, pid)
          return session.text('.remove-success')
        } else if (bindings.filter(item => item.aid === item.bid).length === 1) {
          // cannot remove the last binding
          return session.text('.remove-original')
        } else {
          // create a new account
          const authority = await session.resolve(ctx.root.config.autoAuthorize)
          const user = await ctx.database.create('user', { authority })
          await bind(user.id, platform, pid)
          return session.text('.remove-success')
        }
      }

      const token = generate(session, +!session.isDirect)
      return session.text('.generated-1', [token])
    })

  ctx.middleware(async (session, next) => {
    const token = session.stripped.content
    const data = tokens[token]
    if (!data) return next()
    if (data[0] === session.platform && data[1] === session.userId) {
      return session.text('commands.bind.messages.self-' + (data[2] < 0 ? '2' : '1'))
    }
    delete tokens[token]
    if (data[2] < 0) {
      const [binding] = await ctx.database.get('binding', { platform: data[0], pid: data[1] }, ['aid'])
      await bind(binding.aid, session.platform, session.userId)
      return session.text('commands.bind.messages.success')
    } else {
      const user = await ctx.database.getUser(session.platform, session.userId, ['id', 'authority'])
      if (!user.authority) return session.text('internal.low-authority')
      if (data[2]) {
        const token = generate(session, -1)
        return session.text('commands.bind.messages.generated-2', [token])
      } else {
        await bind(user.id, data[0], data[1])
        return session.text('commands.bind.messages.success')
      }
    }
  }, true)
}
