import { Context, Session } from 'koishi-core'
import { Logger, CQCode, Time } from 'koishi-utils'
import {} from 'koishi-adapter-onebot'

export interface DebugOptions {
  showUserId?: boolean
  showGroupId?: boolean
  refreshUserName?: number
  refreshGroupName?: number
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

export function apply(ctx: Context, config: DebugOptions = {}) {
  const {
    refreshUserName = Time.hour,
    refreshGroupName = Time.hour,
    includeUsers = [],
    includeGroups = [],
    showUserId,
    showGroupId,
  } = config

  const logger = new Logger('message', true)
  Logger.levels.message = 3

  const groupMap: Record<number, [Promise<string>, number]> = {}

  async function getGroupName(session: Session) {
    if (session.subtype === 'private') return '私聊'
    const { groupId: id, $bot } = session
    const timestamp = Date.now()
    if (!groupMap[id] || timestamp - groupMap[id][1] >= refreshGroupName) {
      const promise = $bot.getGroup(id).then(d => d.name, () => '' + id)
      groupMap[id] = [promise, timestamp]
    }
    let output = await groupMap[id][0]
    if (showGroupId && output !== '' + id) {
      output += ` (${id})`
    }
    return output
  }

  const userMap: Record<string, [string | Promise<string>, number]> = {}

  function getSenderName({ anonymous, author, userId }: Session) {
    return anonymous
      ? anonymous.name + (showUserId ? ` (${anonymous.id})` : '')
      : (userMap[userId] = [author.nickname, Date.now()])[0]
      + (showUserId ? ` (${userId})` : '')
  }

  async function formatMessage(session: Session) {
    const codes = CQCode.parseAll(session.content)
    let output = ''
    for (const code of codes) {
      if (typeof code === 'string') {
        output += CQCode.unescape(code)
      } else if (code.type === 'at') {
        if (code.data.qq === 'all') {
          output += '@全体成员'
        } else {
          const id = code.data.qq
          const timestamp = Date.now()
          if (!userMap[id] || timestamp - userMap[id][1] >= refreshUserName) {
            const promise = session.$bot
              .getGroupMember(session.groupId, id)
              .then(d => d.nickname, () => id)
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
  }

  ctx.on('connect', () => {
    Logger.lastTime = Date.now()
  })

  async function onMessage(session: Session) {
    const groupName = await getGroupName(session)
    const senderName = getSenderName(session)
    const message = await formatMessage(session)
    logger.debug(`[${groupName}] ${senderName}: ${message}`)
  }

  if (includeUsers) {
    ctx.private(...includeUsers).on('message', onMessage)
  }

  if (includeGroups) {
    ctx.group(...includeGroups).on('message', onMessage)
  }
}
