import { Bot, Context, Session } from 'koishi-core'
import { Logger, Segment, Time, interpolate, pick } from 'koishi-utils'

export interface DebugOptions {
  formatSend?: string
  formatReceive?: string
  includeUsers?: string[]
  includeChannels?: string[]
  refreshUserName?: number
  refreshChannelName?: number
}

const textSegmentTypes = ['text', 'header', 'section']

const cqTypes = {
  face: '表情',
  record: '语音',
  video: '短视频',
  image: '图片',
  music: '音乐',
  reply: '回复',
  forward: '合并转发',
  dice: '掷骰子',
  rps: '猜拳',
  poke: '戳一戳',
  json: 'JSON',
  xml: 'XML',
  card: '卡片消息',
}

interface Params {
  content?: string
  username?: string
  nickname?: string
  platform?: string
  userId?: string
  channelId?: string
  groupId?: string
  selfId?: string
  channelName?: string
  groupName?: string
}

function getDeps(template: string) {
  const cap = template.match(/\{\{[\s\S]+?\}\}/g) || []
  return cap.map(seg => seg.slice(2, -2).trim())
}

async function getUserName(bot: Bot, groupId: string, userId: string) {
  try {
    const { username } = await bot.getGroupMember(groupId, userId)
    return username
  } catch {
    return userId
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

export function apply(ctx: Context, config: DebugOptions = {}) {
  const {
    formatSend = '[{{ channelName }}] {{ content }}',
    formatReceive = '[{{ channelName }}] {{ username }}: {{ content }}',
    refreshUserName = Time.hour,
    refreshChannelName = Time.hour,
    includeUsers = [],
    includeChannels = [],
  } = config

  const sendDeps = getDeps(formatSend)
  const receiveDeps = getDeps(formatReceive)

  const logger = new Logger('message')
  Logger.levels.message = 3

  const tasks: Record<string, (session: Session.Message) => Promise<any>> = {}
  const channelMap: Record<string, [string | Promise<string>, number]> = {}
  const userMap: Record<string, [string | Promise<string>, number]> = {}

  function on<K extends keyof Params>(key: K, callback: (session: Session.Message) => Promise<Params[K]>) {
    tasks[key] = callback
  }

  ctx.on('connect', () => {
    const timestamp = Date.now()
    ctx.bots.forEach(bot => userMap[bot.sid] = [bot.username, timestamp])
  })

  on('content', async (session) => {
    const codes = Segment.parse(session.content.split('\n', 1)[0])
    let output = ''
    for (const code of codes) {
      if (textSegmentTypes.includes(code.type)) {
        output += Segment.unescape(code.data.content)
      } else if (code.type === 'at') {
        if (code.data.type === 'all') {
          output += '@全体成员'
        } else if (session.subtype === 'group') {
          const id = `${session.platform}:${code.data.qq}`
          const timestamp = Date.now()
          if (!userMap[id] || timestamp - userMap[id][1] >= refreshUserName) {
            userMap[id] = [getUserName(session.$bot, session.groupId, code.data.qq), timestamp]
          }
          output += '@' + await userMap[id][0]
        } else {
          output += '@' + session.$bot.username
        }
      } else if (code.type === 'share' || code.type === 'location') {
        output += `[分享:${code.data.title}]`
      } else if (code.type === 'contact') {
        output += `[推荐${code.data.type === 'qq' ? '好友' : '群'}:${code.data.id}]`
      } else {
        output += `[${cqTypes[code.type] || '未知'}]`
      }
    }
    return output
  })

  on('channelName', async (session) => {
    const timestamp = Date.now()
    const { cid, channelName } = session
    if (channelName) return (channelMap[cid] = [channelName, timestamp])[0]
    if (session.subtype === 'private') return '私聊'
    if (!channelMap[cid] || timestamp - channelMap[cid][1] >= refreshChannelName) {
      channelMap[cid] = [getChannelName(session.$bot, session.channelId), timestamp]
    }
    return await channelMap[cid][0]
  })

  async function handleMessage(deps: string[], template: string, session: Session.Message) {
    const params: Params = pick(session, ['platform', 'channelId', 'groupId', 'userId', 'selfId'])
    Object.assign(params, pick(session.author, ['username', 'nickname']))
    await Promise.all(deps.map(async (key) => {
      const callback = tasks[key]
      params[key] ||= await callback(session)
    }))
    logger.debug(interpolate(template, params))
  }

  ctx.intersect((session) => {
    if (session.subtype === 'private') {
      return includeUsers.length ? includeUsers.includes(session.userId) : true
    } else {
      return includeChannels.length ? includeChannels.includes(session.channelId) : true
    }
  }).plugin((ctx) => {
    ctx.on('message', async (session) => {
      if (session.subtype === 'group') {
        const { assignee } = await session.observeChannel(['assignee'])
        if (assignee !== session.selfId) return
      }

      userMap[session.uid] = [session.author.username, Date.now()]
      handleMessage(receiveDeps, formatReceive, session)
    })

    ctx.before('send', (session) => {
      handleMessage(sendDeps, formatSend, session)
    })
  })
}
