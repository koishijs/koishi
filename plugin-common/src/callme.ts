import { Context, CommandConfig, Meta } from 'koishi-core'

export interface CallmeOptions extends CommandConfig {
  validateName?: (name: string, meta: Meta) => string | void
}

const defaultOptions: CallmeOptions = {
  maxUsage: 3,
  validateName (name, meta) {
    if (name === meta.$user.name) return '称呼未发生变化。'
  },
}

export default function apply (ctx: Context, options: CallmeOptions = {}) {
  ctx.command('callme <name>', '修改自己的称呼', { ...defaultOptions, ...options })
    .userFields(['name'])
    .shortcut('叫我', { prefix: true, fuzzy: true, oneArg: true })
    .action(async ({ meta }, name: string) => {
      if (name === undefined || /^\s*$/.test(name)) {
        return meta.$send(`好的，${meta.$user.name}，请多指教！`)
      }

      name = String(name).trim()
      const message = options.validateName(name, meta)
      if (message) return meta.$send(message)

      try {
        await ctx.database.setUser(meta.userId, { name })
        return meta.$send(`好的，${name}，请多指教！`)
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          return meta.$send('禁止与其他用户重名。')
        } else if (error.code === 'ER_DATA_TOO_LONG') {
          return meta.$send('称呼超出长度限制。')
        }
      }
    })
}
