import { Context, Session, Dict, Time, template, Schema } from 'koishi'
import { parsePlatform } from '@koishijs/command-utils'

template.set('forward', '{0}: {1}')

export interface Rule {
  source: string
  target: string
  selfId?: string
  lifespan?: number
}

export const Rule = Schema.object({
  source: Schema.string().required(),
  target: Schema.string().required(),
  selfId: Schema.string(),
  lifespan: Schema.number(),
})

export const name = 'forward'

export interface Config {
  rules: Rule[]
}

export const schema = Schema.union([
  Schema.object({
    rules: Schema.array(Rule),
  }),
  Schema.transform(Schema.array(Rule), (rules) => ({ rules })),
])

export function apply(ctx: Context, { rules }: Config) {
  const relayMap: Dict<Rule> = {}

  async function sendRelay(session: Session, { target, selfId, lifespan = Time.hour }: Rule) {
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
    const id = await bot.sendMessage(channelId, content, 'unknown')
    relayMap[id] = { source: target, target: session.cid, selfId: session.selfId, lifespan }
    setTimeout(() => delete relayMap[id], lifespan)
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
}
