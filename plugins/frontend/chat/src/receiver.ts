import { Bot, Context, Dict, pick, Schema, segment, Session, Time } from 'koishi'

export interface RefreshConfig {
  user?: number
  guild?: number
  channel?: number
}

export const RefreshConfig: Schema<RefreshConfig> = Schema.object({
  user: Schema.natural().role('ms').description('刷新用户数据的时间间隔。').default(Time.hour),
  guild: Schema.natural().role('ms').description('刷新群组数据的时间间隔。').default(Time.hour),
  channel: Schema.natural().role('ms').description('刷新频道数据的时间间隔。').default(Time.hour),
}).description('刷新选项')

const textSegmentTypes = ['text', 'header', 'section']

const segmentTypes = [
  'at.all',
  'at.here',
  'at.role',
  'at.user',
  'share',
  'contact.friend',
  'contact.guild',
  'face',
  'record',
  'video',
  'image',
  'music',
  'quote',
  'forward',
  'dice',
  'rps',
  'poke',
  'json',
  'xml',
  'card',
] as const

type SegmentType = typeof segmentTypes[number]

function segmentToLocale(session: Session, type: SegmentType, params?: object): string {
  if (segmentTypes.includes(type)) {
    return session.text('chat.segmentTypes.' + type, params)
  }

  return session.text('chat.segmentTypes.unknown')
}

export interface Message {
  avatar?: string
  content?: string
  abstract?: string
  username?: string
  nickname?: string
  platform?: string
  messageId?: string
  userId?: string
  channelId?: string
  guildId?: string
  selfId?: string
  selfName?: string
  channelName?: string
  guildName?: string
  timestamp?: number
  quote?: Message
}

async function getUserName(bot: Bot, guildId: string, userId: string) {
  try {
    const { username } = await bot.getGuildMember(guildId, userId)
    return username
  } catch {
    return userId
  }
}

async function getGroupName(bot: Bot, guildId: string) {
  try {
    const { guildName } = await bot.getGuild(guildId)
    return guildName
  } catch {
    return guildId
  }
}

async function getChannelName(bot: Bot, channelId: string, guildId: string) {
  try {
    const { channelName } = await bot.getChannel(channelId, guildId)
    return channelName
  } catch {
    return channelId
  }
}

export default function receiver(ctx: Context, config: RefreshConfig = {}) {
  const {
    user: refreshUserName = Time.hour,
    guild: refreshGroupName = Time.hour,
    channel: refreshChannelName = Time.hour,
  } = config

  const channelMap: Dict<[Promise<string>, number]> = {}
  const groupMap: Dict<[Promise<string>, number]> = {}
  const userMap: Dict<[Promise<string>, number]> = {}

  ctx.on('ready', () => {
    const timestamp = Date.now()
    ctx.bots.forEach(bot => userMap[bot.sid] = [Promise.resolve(bot.username), timestamp])
  })

  async function prepareChannel(session: Session, params: Message, timestamp: number) {
    const { cid, guildId, channelName } = session
    if (channelName) {
      channelMap[cid] = [Promise.resolve(channelName), timestamp]
      return
    }
    if (!guildId) return
    if (!channelMap[cid] || timestamp - channelMap[cid][1] >= refreshChannelName) {
      channelMap[cid] = [getChannelName(session.bot, session.channelId, session.guildId), timestamp]
    }
    params.channelName = await channelMap[cid][0]
  }

  async function prepareGroup(session: Session, params: Message, timestamp: number) {
    const { cid, gid, guildId, guildName } = session
    if (guildName) {
      groupMap[gid] = [Promise.resolve(guildName), timestamp]
      return
    }
    if (!guildId || cid === gid) return
    if (!groupMap[gid] || timestamp - groupMap[gid][1] >= refreshGroupName) {
      groupMap[gid] = [getGroupName(session.bot, guildId), timestamp]
    }
    params.guildName = await groupMap[gid][0]
  }

  async function prepareAbstract(session: Session, params: Message, timestamp: number) {
    const stl = segmentToLocale.bind(this, session)

    const codes = segment.parse(params.content.split(/\r?\n/, 1)[0])
    params.abstract = ''
    for (const code of codes) {
      if (textSegmentTypes.includes(code.type)) {
        params.abstract += segment.unescape(code.data.content)
      } else if (code.type === 'at') {
        if (code.data.type === 'all') {
          params.abstract += stl('at.all')
        } else if (code.data.type === 'here') {
          params.abstract += stl('at.here')
        } else if (code.data.role) {
          params.abstract += stl('at.role')
        } else if (session.subtype === 'group') {
          const id = `${session.platform}:${code.data.id}`
          if (code.data.name) {
            userMap[id] = [Promise.resolve(code.data.name), timestamp]
          } else if (!userMap[id] || timestamp - userMap[id][1] >= refreshUserName) {
            userMap[id] = [getUserName(session.bot, session.guildId, code.data.id), timestamp]
          }
          params.abstract += stl('at.user', [(code.data.name = await userMap[id][0])])
        } else {
          params.abstract += stl('at.user', [session.bot.username])
        }
      } else if (code.type === 'share' || code.type === 'location') {
        params.abstract += stl('share', [code.data.title])
      } else if (code.type === 'contact') {
        params.abstract += stl(code.data.type === 'qq' ? 'contact.friend' : 'contact.guild', [code.data.id])
      } else {
        params.abstract += `[${stl(code.type as SegmentType)}]`
      }
    }
  }

  async function prepareContent(session: Session, message: Message, timestamp: number) {
    message.content = await session.preprocess()
    const tasks = [prepareAbstract(session, message, timestamp)]
    // eslint-disable-next-line no-cond-assign
    if (message.quote = session.quote) {
      tasks.push(prepareAbstract(session, message.quote, timestamp))
    }
    await Promise.all(tasks)
  }

  async function handleMessage(session: Session) {
    const params: Message = pick(session, [
      'content', 'timestamp', 'messageId', 'platform', 'selfId',
      'channelId', 'channelName', 'guildId', 'guildName', 'userId',
    ], true)
    Object.assign(params, pick(session.author, ['username', 'nickname', 'avatar'], true))
    if (session.type === 'message') {
      userMap[session.uid] = [Promise.resolve(session.author.username), Date.now()]
    }
    const { cid, channelName } = session
    const timestamp = Date.now()
    if (channelName) {
      session.channelName = channelName
      channelMap[cid] = [Promise.resolve(channelName), timestamp]
    }
    params.selfName = session.bot.username
    await Promise.all([prepareChannel, prepareGroup, prepareContent].map(cb => cb(session, params, timestamp)))
    ctx.emit('chat/receive', params, session)
  }

  ctx.any().on('message', handleMessage)
}
