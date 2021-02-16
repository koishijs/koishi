import { Context, Session } from 'koishi-core'
import { Logger, CQCode, Time, interpolate, pick } from 'koishi-utils'

export interface DebugOptions {
  format?: string
  refreshUserName?: number
  refreshChannelName?: number
  includeUsers?: string[]
  includeGroups?: string[]
}

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

export function apply(ctx: Context, config: DebugOptions = {}) {
  const {
    format = '[{{ channelName }}] {{ username }}: {{ content }}',
    refreshUserName = Time.hour,
    refreshChannelName = Time.hour,
    includeUsers = [],
    includeGroups = [],
  } = config

  const cap = format.match(/\{\{[\s\S]+?\}\}/g) || []
  const keys = cap.map(seg => seg.slice(2, -2).trim())

  const logger = new Logger('message')
  Logger.levels.message = 3

  const tasks: ((params: any, session: Session) => Promise<any>)[] = []
  const channelMap: Record<number, [string | Promise<string>, number]> = {}
  const userMap: Record<string, [string | Promise<string>, number]> = {}

  // function getAuthorName({ anonymous, author, userId }: Session) {
  //   return anonymous
  //     ? anonymous.name + (showUserId ? ` (${anonymous.id})` : '')
  //     : (userMap[userId] = [author.username, Date.now()])[0]
  //     + (showUserId ? ` (${userId})` : '')
  // }

  function on<K extends keyof Params>(key: K, callback: (session: Session) => Promise<Params[K]>) {
    if (!keys.includes(key)) return
    tasks.push(async (params: any, session: Session) => params[key] = await callback(session))
  }

  async function onMessage(session: Session) {
    userMap[session.userId] = [session.author.username, Date.now()]
    const params: Params = {
      ...pick(session, ['platform', 'channelId', 'groupId', 'userId', 'selfId']),
      ...pick(session.author, ['username', 'nickname']),
    }
    await Promise.all(tasks.map(task => task(params, session)))
    logger.debug(interpolate(format, params))
  }

  on('content', async (session: Session) => {
    const codes = CQCode.build(session.content.split('\n', 1)[0])
    let output = ''
    for (const code of codes) {
      if (typeof code === 'string') {
        output += CQCode.unescape(code)
      } else if (code.type === 'at') {
        if (code.data.qq === 'all') {
          output += '@全体成员'
        } else if (session.subtype === 'group') {
          const id = code.data.qq
          const timestamp = Date.now()
          if (!userMap[id] || timestamp - userMap[id][1] >= refreshUserName) {
            const promise = session.$bot
              .getGroupMember(session.groupId, id)
              .then(d => d.username, () => id)
            userMap[id] = [promise, timestamp]
          }
          output += '@' + await userMap[id][0]
        }
      } else if (code.type === 'share' || code.type === 'location') {
        output += `[分享:${code.data.title}]`
      } else if (code.type === 'contact') {
        output += `[推荐${code.data.type === 'qq' ? '好友' : '群'}:${code.data.id}]`
      } else {
        output += `[${cqTypes[code.type]}]`
      }
    }
    return output
  })

  on('channelName', async (session: Session) => {
    const timestamp = Date.now()
    if (session.channelName) return (channelMap[session.channelId] = [session.channelName, timestamp])[0]
    if (session.subtype === 'private') return '私聊'
    const { channelId: id, $bot } = session
    if (!channelMap[id] || timestamp - channelMap[id][1] >= refreshChannelName) {
      const promise = $bot.getChannel?.(id).then(d => d.channelName, () => '' + id) || '' + id
      channelMap[id] = [promise, timestamp]
    }
    return await channelMap[id][0]
  })

  if (includeUsers) {
    ctx.private(...includeUsers).on('message', onMessage)
  }

  if (includeGroups) {
    ctx.group(...includeGroups).on('message', onMessage)
  }
}
