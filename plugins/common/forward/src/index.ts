import { Context, Session, Dict, Time, template, Schema, Command } from 'koishi'
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
  selfId: string
}

export const Rule = Schema.object({
  source: Schema.string().required(),
  target: Schema.string().required(),
  selfId: Schema.string().required(),
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

  async function sendRelay(session: Session, target: string, selfId?: string) {
    const { author, parsed } = session
    if (!parsed.content) return

    // get selfId
    const [platform, channelId] = parsePlatform(target)
    if (!selfId) {
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
    })
  }

  function handleError(error: any) {
    ctx.logger('forward').warn(error)
  }

  ctx.before('attach-channel', (session, fields) => {
    fields.add('forward')
  })

  ctx.middleware(async (session: Session<never, 'forward'>, next) => {
    const { quote = {}, subtype } = session
    if (subtype !== 'group') return
    const data = relayMap[quote.messageId]
    if (data) return sendRelay(session, data.target, data.selfId)

    const tasks: Promise<void>[] = []
    if (ctx.database) {
      for (const target of session.channel.forward) {
        tasks.push(sendRelay(session, target).catch(handleError))
      }
    } else {
      for (const rule of rules) {
        if (session.cid !== rule.source) continue
        tasks.push(sendRelay(session, rule.target, rule.selfId).catch(handleError))
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
      .command('forward [operation:string] <channel:channel>', '设置消息转发', { authority: 3 })
      .usage(session => `当前频道 ID：${session.cid}`)
      .alias('fwd')

    const register = (def: string, desc: string, callback: Command.Action<never, 'forward', [string]>) => cmd
      .subcommand(def, desc, { authority: 3, checkArgCount: true })
      .channelFields(['forward'])
      .action(callback)

    register('.add <channel:channel>', '添加目标频道', async ({ session }, id) => {
      const { forward } = session.channel
      if (forward.includes(id)) {
        return `${id} 已经是当前频道的目标频道。`
      } else {
        forward.push(id)
        return `已成功添加目标频道 ${id}。`
      }
    })

    register('.remove <channel:channel>', '移除目标频道', async ({ session }, id) => {
      const { forward } = session.channel
      const index = forward.indexOf(id)
      if (index >= 0) {
        forward.splice(index, 1)
        return `已成功移除目标频道 ${id}。`
      } else {
        return `${id} 不是当前频道的目标频道。`
      }
    }).alias('forward.rm')

    register('.clear', '移除全部目标频道', async ({ session }) => {
      session.channel.forward = []
      return '已成功移除全部目标频道。'
    })

    register('.list', '查看目标频道列表', async ({ session }) => {
      const { forward } = session.channel
      if (!forward.length) return '当前频道没有设置目标频道。'
      return ['当前频道的目标频道列表为：', ...forward].join('\n')
    }).alias('forward.ls')
  })
}
