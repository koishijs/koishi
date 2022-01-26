import { Context, Session, Dict, Time, template, Schema } from 'koishi'
import { parsePlatform } from '@koishijs/helpers'

declare module 'koishi' {
  interface Channel {
    forward: string[]
  }
}

template.set('forward', '{0}: {1}')

export interface Rule {
  source: string
  target: string
  selfId?: string
}

export const Rule = Schema.object({
  source: Schema.string().required(),
  target: Schema.string().required(),
  selfId: Schema.string(),
})

export const name = 'forward'

export interface Config {
  rules: Rule[]
  interval?: number
}

export const schema = Schema.union([
  Schema.object({
    rules: Schema.array(Rule),
    interval: Schema.number().default(Time.hour),
  }),
  Schema.transform(Schema.array(Rule), (rules) => ({ rules })),
])

export function apply(ctx: Context, { rules, interval }: Config) {
  const relayMap: Dict<Rule> = {}

  async function sendRelay(session: Session, { target, selfId }: Rule) {
    const { author, parsed } = session
    if (!parsed.content) return

    // get selfId
    const [platform, channelId] = parsePlatform(target)
    if (!selfId) {
      if (!ctx.database) throw new Error('database service is required when selfId is not specified')
      const channel = await ctx.database.getChannel(platform, channelId, ['assignee'])
      if (!channel || !channel.assignee) return
      selfId = channel.assignee
    }

    const bot = ctx.bots.get(`${platform}:${selfId}`)
    const content = template('forward', author.nickname || author.username, parsed.content)
    await bot.sendMessage(channelId, content).then((ids) => {
      for (const id of ids) {
        relayMap[id] = { source: target, target: session.cid, selfId: session.selfId }
        ctx.setTimeout(() => delete relayMap[id], interval)
      }
    }, (error) => {
      ctx.logger('bot').warn(error)
    })
  }

  ctx.middleware(async (session, next) => {
    const { quote = {} } = session
    const data = relayMap[quote.messageId]
    if (data) return sendRelay(session, data)
    const tasks: Promise<void>[] = []
    for (const options of rules) {
      if (session.cid !== options.source) continue
      tasks.push(sendRelay(session, options))
    }
    const [result] = await Promise.all([next(), Promise.allSettled(tasks)])
    return result
  })

  ctx.model.extend('channel', {
    forward: 'list',
  })

  ctx.using(['database'], (ctx) => {
    ctx.command('forward <channel:channel>', '设置消息转发', { authority: 3, checkUnknown: true })
      .channelFields(['forward'])
      .option('add', '-a  添加目标频道')
      .option('delete', '-d  移除目标频道')
      .option('clear', '-c  移除全部目标频道')
      .option('list', '-l  查看目标频道列表')
      .usage(session => `当前频道 ID：${session.cid}`)
      .before(async ({ session, options }, id) => {
        if (options.add || options.delete) {
          return id ? null : '请提供目标频道。'
        } else if (Object.keys(options).length) {
          return
        }
        return session.execute({
          name: 'help',
          args: ['forward'],
        })
      })
      .action(async ({ session, options }, id) => {
        const { forward } = session.channel
        if (options.add) {
          if (forward.includes(id)) {
            return `${id} 已经是当前频道的目标频道。`
          } else {
            forward.push(id)
            return `已成功添加目标频道 ${id}。`
          }
        } else if (options.delete) {
          const index = forward.indexOf(id)
          if (index >= 0) {
            forward.splice(index, 1)
            return `已成功移除目标频道 ${id}。`
          } else {
            return `${id} 不是当前频道的目标频道。`
          }
        } else if (options.clear) {
          session.channel.forward = []
          return '已成功移除全部目标频道。'
        } else if (options.list) {
          if (!forward.length) return '当前频道没有设置目标频道。'
          return ['当前频道的目标频道列表为：', ...forward].join('\n')
        }
      })
  })
}
