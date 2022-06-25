import { parsePlatform } from '@koishijs/helpers'
import { Context, Dict, Schema, segment, Session, Time } from 'koishi'

export interface Filter {
  type: 'user' | 'flag' | 'all'
  data?: string[]
}

export interface Rule {
  source: string
  filter: Filter
  target: string
  selfId: string
  guildId?: string
}

export interface DBRule {
  id: number
  source: string
  filter: Filter
  target: string
}

declare module 'koishi' {
  interface Tables {
    forward: DBRule
  }
}

// @ts-ignore
export const Filter: Schema<Filter> = Schema.object({
  type: Schema.union([Schema.const('user'), Schema.const('flag'), Schema.const('all')]).required().default('all').description('过滤器类型'),
  data: Schema.array(Schema.string()).description('过滤器数据'),
})

// @ts-ignore
export const Rule: Schema<Rule> = Schema.object({
  source: Schema.string().required().description('来源频道。'),
  filter: Schema.object(Filter).required().description('过滤器'),
  target: Schema.string().required().description('目标频道。'),
  selfId: Schema.string().required().description('负责推送的机器人账号。'),
  guildId: Schema.string().description('目标频道的群组编号。'),
}).description('转发规则。')

export const name = 'forward'

export interface Config {
  rules: Rule[]
  interval?: number
}

export const Config = Schema.union([
  Schema.object({
    rules: Schema.array(Rule).description('转发规则列表。'),
    interval: Schema.natural().role('ms').default(Time.hour).description('推送消息不再响应回复的时间。'),
  }),
  Schema.transform(Schema.array(Rule), (rules) => ({
    rules,
    interval: Time.hour,
  })),
])

function defaultFilter(session: Session, filter: Filter) {
  switch (filter.type) {
    case 'user': {
      return filter.data.findIndex((n) => n === session.uid) !== -1
    }
    case 'flag': {
      for (const pat of filter.data) {
        if (new RegExp(pat).test(session.content)) return true
      }
      return false
    }
    case 'all': {
      return true
    }
  }
}

export function apply(ctx: Context, {
  rules,
  interval,
}: Config) {
  ctx.i18n.define('zh', require('./locales/zh'))

  const relayMap: Dict<Rule> = {}

  async function sendRelay(session: Session, rule: Partial<Rule>) {
    const {
      author,
      parsed,
    } = session
    if (!parsed.content) return
    if (!defaultFilter(session, rule.filter)) return

    try {
      // get selfId
      const [platform, channelId] = parsePlatform(rule.target)
      if (!rule.selfId) {
        const channel = await ctx.database.getChannel(platform, channelId, ['assignee', 'guildId'])
        if (!channel || !channel.assignee) return
        rule.selfId = channel.assignee
        rule.guildId = channel.guildId
      }

      const bot = ctx.bots.get(`${platform}:${rule.selfId}`)
      const chain = segment.parse(parsed.content)

      // replace all mentions (koishijs/koishi#506)
      if (chain.some(item => item.type === 'at')) {
        const dict = await session.bot.getGuildMemberMap(session.guildId)
        chain.forEach((item, index) => {
          if (item.type === 'at') {
            const content = '@' + dict[item.data.id]
            chain.splice(index, 1, { type: 'text', data: { content } })
          }
        })
      }

      const content = `${author.nickname || author.username}: ${segment.join(chain)}`
      await bot.sendMessage(channelId, content, rule.guildId).then((ids) => {
        for (const id of ids) {
          relayMap[id] = {
            source: rule.target,
            filter: rule.filter,
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

  ctx.middleware(async (session: Session<never, never>, next) => {
    const {
      quote = {},
      subtype,
    } = session
    if (subtype !== 'group') return
    const data = relayMap[quote.messageId]
    if (data) return sendRelay(session, data)

    const tasks: Promise<void>[] = []
    if (ctx.database) {
      const rules = await ctx.database.get('forward', {})
      for (const rule of rules) {
        const target = rule.target
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

  ctx.model.extend('forward', {
    id: 'integer',
    source: 'string',
    filter: 'json',
    target: 'string',
  }, {
    autoInc: true,
    primary: 'id',
  })

  ctx.using(['database'], (ctx) => {
    function generateFilter(options: any) {
      if (options.user) {
        const filter: Filter = {
          type: 'user',
          data: [options.user],
        }
        return filter
      } else if (options.flag) {
        const filter: Filter = {
          type: 'flag',
          data: [options.flag],
        }
        return filter
      } else {
        const filter: Filter = {
          type: 'all',
        }
        return filter
      }
    }

    const cmd = ctx
      .command('forward [operation:string] <channel:channel>', { authority: 3 })
      .alias('fwd')

    cmd.subcommand('.add <channel:channel>', {
      authority: 3,
      checkArgCount: true,
    })
      .option('user', '-U <user:user>')
      .option('flag', '-F <flag:string>')
      .option('all', '-A')
      .check(({
        session,
        options,
      }) => {
        if (JSON.stringify(options) === '{}') options.all = true
      })
      .action(async ({
        session,
        options,
      }, channel) => {
        try {
          await ctx.database.create('forward', {
            source: session.cid,
            target: channel,
            filter: generateFilter(options),
          })
          session.text('.changed')
        } catch (e) {
          ctx.logger('forward').error(e)
        }
      })

    cmd.subcommand('.list', {
      authority: 3,
      checkArgCount: true,
    })
      .action(async ({ session }) => {
        try {
          const rules = await ctx.database.get('forward', { source: session.cid })
          session.text('.list', rules)
        } catch (e) {
          ctx.logger('forward').error(e)
          session.text('.error')
        }
      }).alias('forward.ls')

    cmd.subcommand('.clear', {
      authority: 3,
      checkArgCount: true,
    })
      .action(async ({ session }) => {
        try {
          await ctx.database.remove('forward', { source: session.cid })
          session.text('.success')
        } catch (e) {
          ctx.logger('forward').error(e)
          session.text('.error')
        }
      })
    cmd.subcommand('.remove <channel:channel>', {
      authority: 3,
      checkArgCount: true,
    })
      .option('user', '-U <user:user>')
      .option('flag', '-F <flag:string>')
      .action(async ({ session, options }, target) => {
        try {
          const res = await ctx.database.get('forward', {
            $and: [
              { source: session.cid },
              { target: target },
            ],
          })
          if (res.length > 1) {
            if (!options.flag && !options.user) return session.text('.error')
            else if (options.flag && options.user) return session.text('.error')
            else {
              // @ts-ignore
              await ctx.database.remove('forward', {
                $and: [
                  { source: session.cid },
                  { target: target },
                  { filter: generateFilter(options) },
                ],
              })
            }
          } else {
            await ctx.database.remove('forward', {
              $and: [
                { source: session.cid },
                { target: target },
              ],
            })
          }
          return session.text('.success')
        } catch (e) {
          ctx.logger('forward').error(e)
          session.text('.error')
        }
      })
  })
}
