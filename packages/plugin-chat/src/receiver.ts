import { Bot, Context, Session } from 'koishi-core'
import { Time, pick, segment } from 'koishi-utils'

export interface ReceiverConfig {
  refreshUserName?: number
  refreshGroupName?: number
  refreshChannelName?: number
}

const textSegmentTypes = ['text', 'header', 'section']

const segmentTypes = {
  face: '表情',
  record: '语音',
  video: '短视频',
  image: '图片',
  music: '音乐',
  quote: '引用',
  forward: '合并转发',
  dice: '掷骰子',
  rps: '猜拳',
  poke: '戳一戳',
  json: 'JSON',
  xml: 'XML',
  card: '卡片消息',
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
  groupId?: string
  selfId?: string
  channelName?: string
  groupName?: string
  timestamp?: number
  quote?: Message
}

async function getUserName(bot: Bot, groupId: string, userId: string) {
  try {
    const { username } = await bot.getGroupMember(groupId, userId)
    return username
  } catch {
    return userId
  }
}

async function getGroupName(bot: Bot, groupId: string) {
  try {
    const { groupName } = await bot.getGroup(groupId)
    return groupName
  } catch {
    return groupId
  }
}

async function getChannelName(bot: Bot, channelId: string) {
  try {
    const { channelName } = await bot.getChannel(channelId)
    return channelName
  } catch {
    return channelId
  }
}

export default function apply(ctx: Context, config: ReceiverConfig = {}) {
  const {
    refreshUserName = Time.hour,
    refreshGroupName = Time.hour,
    refreshChannelName = Time.hour,
  } = config

  const channelMap: Record<string, [Promise<string>, number]> = {}
  const groupMap: Record<string, [Promise<string>, number]> = {}
  const userMap: Record<string, [Promise<string>, number]> = {}

  ctx.on('connect', () => {
    const timestamp = Date.now()
    ctx.bots.forEach(bot => userMap[bot.sid] = [Promise.resolve(bot.username), timestamp])
  })

  async function prepareChannel(session: Session, params: Message, timestamp: number) {
    const { cid, groupId, channelName } = session
    if (channelName) {
      channelMap[cid] = [Promise.resolve(channelName), timestamp]
      return
    }
    if (!groupId) return
    if (!channelMap[cid] || timestamp - channelMap[cid][1] >= refreshChannelName) {
      channelMap[cid] = [getChannelName(session.bot, session.channelId), timestamp]
    }
    params.channelName = await channelMap[cid][0]
  }

  async function prepareGroup(session: Session, params: Message, timestamp: number) {
    const { cid, gid, groupId, groupName } = session
    if (groupName) {
      groupMap[gid] = [Promise.resolve(groupName), timestamp]
      return
    }
    if (!groupId || cid === gid) return
    if (!groupMap[gid] || timestamp - groupMap[gid][1] >= refreshGroupName) {
      groupMap[gid] = [getGroupName(session.bot, groupId), timestamp]
    }
    params.groupName = await groupMap[gid][0]
  }

  async function prepareAbstract(session: Session, params: Message, timestamp: number) {
    const codes = segment.parse(params.content.split('\n', 1)[0])
    params.abstract = ''
    for (const code of codes) {
      if (textSegmentTypes.includes(code.type)) {
        params.abstract += segment.unescape(code.data.content)
      } else if (code.type === 'at') {
        if (code.data.type === 'all') {
          params.abstract += '@全体成员'
        } else if (session.subtype === 'group') {
          const id = `${session.platform}:${code.data.id}`
          if (!userMap[id] || timestamp - userMap[id][1] >= refreshUserName) {
            userMap[id] = [getUserName(session.bot, session.groupId, code.data.id), timestamp]
          }
          params.abstract += '@' + await userMap[id][0]
        } else {
          params.abstract += '@' + session.bot.username
        }
      } else if (code.type === 'share' || code.type === 'location') {
        params.abstract += `[分享:${code.data.title}]`
      } else if (code.type === 'contact') {
        params.abstract += `[推荐${code.data.type === 'qq' ? '好友' : '群'}:${code.data.id}]`
      } else {
        params.abstract += `[${segmentTypes[code.type] || '未知'}]`
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
      'channelId', 'channelName', 'groupId', 'groupName', 'userId',
    ])
    Object.assign(params, pick(session.author, ['username', 'nickname', 'avatar']))
    if (session.type === 'message') {
      userMap[session.uid] = [Promise.resolve(session.author.username), Date.now()]
    }
    const { cid, channelName } = session
    const timestamp = Date.now()
    if (channelName) {
      session.channelName = channelName
      channelMap[cid] = [Promise.resolve(channelName), timestamp]
    }
    await Promise.all([prepareChannel, prepareGroup, prepareContent].map(cb => cb(session, params, timestamp)))
    ctx.emit('chat/receive', params, session)
  }

  ctx.on('message', handleMessage)
  ctx.on('send', handleMessage)
}
