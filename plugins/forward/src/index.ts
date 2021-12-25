import { Context, Session, Dict, Time, template } from 'koishi'

declare module 'koishi' {
  interface Modules {
    forward: typeof import('.')
  }
}

template.set('forward', '{0}: {1}')

function parsePlatform(target: string): [platform: string, id: string] {
  const index = target.indexOf(':')
  const platform = target.slice(0, index)
  const id = target.slice(index + 1)
  return [platform, id] as any
}

export interface ForwardOptions {
  source: string
  destination: string
  selfId?: string
  lifespan?: number
}

export const name = 'forward'

export interface Config {
  tunnels: ForwardOptions[]
}

export function apply(ctx: Context, tunnels: ForwardOptions[]) {
  const relayMap: Dict<ForwardOptions> = {}

  async function sendRelay(session: Session, { destination, selfId, lifespan = Time.hour }: ForwardOptions) {
    const [platform, channelId] = parsePlatform(destination)
    const bot = ctx.bots.get(`${platform}:${selfId}`)
    const { author, parsed } = session
    if (!parsed.content) return
    const content = template('forward', author.nickname || author.username, parsed.content)
    const id = await bot.sendMessage(channelId, content, 'unknown')
    relayMap[id] = { source: destination, destination: session.cid, selfId: session.selfId, lifespan }
    setTimeout(() => delete relayMap[id], lifespan)
  }

  ctx.middleware((session, next) => {
    const { quote = {} } = session
    const data = relayMap[quote.messageId]
    if (data) return sendRelay(session, data)
    const tasks: Promise<void>[] = []
    for (const options of tunnels) {
      if (session.cid !== options.source) continue
      tasks.push(sendRelay(session, options).catch())
    }
    tasks.push(next())
    return Promise.all(tasks)
  })
}
