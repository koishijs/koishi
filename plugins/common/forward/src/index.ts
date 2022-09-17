import { Command, Context, Dict, Schema, segment, Session, Time } from 'koishi'
import { parsePlatform } from '@koishijs/helpers'
import zh from './locales/zh.yml'

declare module 'koishi' {
  interface Channel {
    forward: string[]
  }
}

export interface Rule {
  source: string
  target: string
  selfId: string
  guildId?: string
}

export const Rule: Schema<Rule> = Schema.object({
  source: Schema.string().required().description('来源频道。'),
  target: Schema.string().required().description('目标频道。'),
  selfId: Schema.string().required().description('负责推送的机器人账号。'),
  guildId: Schema.string().description('目标频道的群组编号。'),
}).description('转发规则。')

export const name = 'forward'

export interface Config {
  rules: Rule[]
  interval?: number
}

export const Config: Schema<Config | Rule[], Config> = Schema.union([
  Schema.object({
    rules: Schema.array(Rule).description('转发规则列表。'),
    interval: Schema.natural().role('ms').default(Time.hour).description('推送消息不再响应回复的时间。'),
  }),
  Schema.transform(Schema.array(Rule), (rules) => ({ rules, interval: Time.hour })),
])

export function apply(ctx: Context, { rules, interval }: Config) {
  ctx.i18n.define('zh', zh)

  const relayMap: Dict<Rule> = {}

  async function sendRelay(session: Session, rule: Partial<Rule>) {
    const { author, parsed } = session
    if (!parsed.content) return

    try {
      // get selfId
      const [platform, channelId] = parsePlatform(rule.target)
      if (!rule.selfId) {
        const channel = await ctx.database.getChannel(platform, channelId, ['assignee', 'guildId'])
        if (!channel || !channel.assignee) return
        rule.selfId = channel.assignee
        rule.guildId = channel.guildId
      }

      const bot = ctx.bots[`${platform}:${rule.selfId}`]
      const chain = segment.parse(parsed.content)

      // replace all mentions (koishijs/koishi#506)
      if (chain.some(item => item.type === 'at')) {
        const dict = await session.bot.getGuildMemberMap(session.guildId)
        chain.forEach((item, index) => {
          if (item.type === 'at') {
            const content = '@' + dict[item.attrs.id]
            chain.splice(index, 1, segment('text', { content }))
          }
        })
      }

      const content = `${author.nickname || author.username}: ${chain.join('')}`
      await bot.sendMessage(channelId, content, rule.guildId).then((ids) => {
        for (const id of ids) {
          relayMap[id] = {
            source: rule.target,
            target: session.cid,
            selfId: session.selfId,
            guildId: session.guildId,
          }
          ctx.setTimeout(() => delete relayMap[id], interval)
        }
      })
    } catch (error) {
      ctx.logger('forward').warn(error)
    }
  }

  ctx.before('attach-channel', (session, fields) => {
    fields.add('forward')
  })

  ctx.middleware(async (session: Session<never, 'forward'>, next) => {
    const { quote = {}, subtype } = session
    if (subtype !== 'group') return
    const data = relayMap[quote.messageId]
    if (data) return sendRelay(session, data)

    const tasks: Promise<void>[] = []
    if (ctx.database) {
      for (const target of session.channel.forward) {
        tasks.push(sendRelay(session, { target }))
      }
    } else {
      for (const rule of rules) {
        if (session.cid !== rule.source) continue
        tasks.push(sendRelay(session, rule))
      }
    }
    const [result] = await Promise.all([next(), ...tasks])
    return result
  })

  ctx.model.extend('channel', {
    forward: 'list',
  })

  ctx.using(['database'], (ctx) => {
    const cmd = ctx
      .command('forward [operation:string] <channel:channel>', { authority: 3 })
      .alias('fwd')

    const register = (def: string, callback: Command.Action<never, 'forward', [string]>) => cmd
      .subcommand(def, { authority: 3, checkArgCount: true })
      .channelFields(['forward'])
      .action(callback)

    register('.add <channel:channel>', async ({ session }, id) => {
      const { forward } = session.channel
      if (forward.includes(id)) {
        return session.text('.unchanged', [id])
      } else {
        forward.push(id)
        return session.text('.updated', [id])
      }
    })

    register('.remove <channel:channel>', async ({ session }, id) => {
      const { forward } = session.channel
      const index = forward.indexOf(id)
      if (index >= 0) {
        forward.splice(index, 1)
        return session.text('.updated', [id])
      } else {
        return session.text('.unchanged', [id])
      }
    }).alias('forward.rm')

    register('.clear', async ({ session }) => {
      session.channel.forward = []
      return session.text('.updated')
    })

    register('.list', async ({ session }) => {
      const { forward } = session.channel
      if (!forward.length) return session.text('.empty')
      return [session.text('.header'), ...forward].join('\n')
    }).alias('forward.ls')
  })
}
