import { Context, Session, Dict, Time, template, Schema } from 'koishi'
import { parsePlatform } from '@koishijs/command-utils'

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
  lifespan?: number
}

export const schema = Schema.union([
  Schema.object({
    rules: Schema.array(Rule),
    lifespan: Schema.number(),
  }),
  Schema.transform(Schema.array(Rule), (rules) => ({ rules })),
])

export function apply(ctx: Context, { rules, lifespan = Time.hour }: Config) {
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
        ctx.setTimeout(() => delete relayMap[id], lifespan)
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
}
