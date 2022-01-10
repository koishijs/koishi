import { Context, Session, Dict, Time, template, Schema } from 'koishi'
import { parsePlatform } from '@koishijs/command-utils'

template.set('forward', '{0}: {1}')

export interface Rule {
  source: string
  destination: string
  selfId?: string
  lifespan?: number
}

export const Rule = Schema.object({
  source: Schema.string().required(),
  destination: Schema.string().required(),
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

  async function sendRelay(session: Session, { destination, selfId, lifespan = Time.hour }: Rule) {
    const [platform, channelId] = parsePlatform(destination)
    const bot = ctx.bots.get(`${platform}:${selfId}`)
    const { author, parsed } = session
    if (!parsed.content) return
    const content = template('forward', author.nickname || author.username, parsed.content)
    const id = await bot.sendMessage(channelId, content, 'unknown')
    relayMap[id] = { source: destination, destination: session.cid, selfId: session.selfId, lifespan }
    setTimeout(() => delete relayMap[id], lifespan)
  }

  ctx.middleware(async (session, next) => {
    const { quote = {} } = session
    const data = relayMap[quote.messageId]
    if (data) return sendRelay(session, data)
    const tasks: Promise<void>[] = []
    for (const options of rules) {
      if (session.cid !== options.source) continue
      tasks.push(sendRelay(session, options).catch())
    }
    const [result] = await Promise.all([next(), ...tasks])
    return result
  })
}
