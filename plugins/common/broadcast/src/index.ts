import { Channel, Context, Schema } from 'koishi'
import zh from './locales/zh.yml'

export interface Config {}

export const name = 'broadcast'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.i18n.define('zh', zh)

  ctx.command('broadcast <message:text>', { authority: 4 })
    .option('forced', '-f')
    .option('only', '-o')
    .action(async ({ options, session }, message) => {
      if (!message) return session.text('.expect-text')
      if (!options.only) {
        await ctx.broadcast(message, options.forced)
        return
      }

      const fields: ('id' | 'flag')[] = ['id']
      if (!options.forced) fields.push('flag')
      let channels = await ctx.database.getAssignedChannels(fields, { [session.platform]: [session.selfId] })
      if (!options.forced) {
        channels = channels.filter(g => !(g.flag & Channel.Flag.silent))
      }
      await session.bot.broadcast(channels.map(channel => channel.id), message)
    })
}
