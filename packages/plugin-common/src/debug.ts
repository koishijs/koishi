import { Context, Session } from 'koishi-core'
import { Logger, CQCode, Time } from 'koishi-utils'
import {} from 'koishi-adapter-cqhttp'

export interface DebugOptions {
  showUserId?: boolean
  showGroupId?: boolean
  refreshUserName?: number
  refreshGroupName?: number
}

export function apply(ctx: Context, config: DebugOptions = {}) {
  const { refreshUserName = Time.hour, refreshGroupName = Time.hour, showUserId, showGroupId } = config
  const logger = Logger.create('message', true)
  Logger.levels.message = 3

  const groupMap: Record<number, [Promise<string>, number]> = {}

  async function getGroupName(session: Session) {
    if (session.messageType === 'private') return '私聊'
    const { groupId: id, $bot } = session
    const timestamp = Date.now()
    if (!groupMap[id] || timestamp - groupMap[id][1] >= refreshGroupName) {
      const promise = $bot.getGroupInfo(id).then(d => d.groupName, () => '' + id)
      groupMap[id] = [promise, timestamp]
    }
    let output = await groupMap[id][0]
    if (showGroupId && output !== '' + id) {
      output += ` (${id})`
    }
    return output
  }

  const userMap: Record<number, [string | Promise<string>, number]> = {}

  function getSenderName({ anonymous, sender, userId }: Session) {
    return anonymous
      ? anonymous.name + (showUserId ? ` (${anonymous.id})` : '')
      : (userMap[userId] = [sender.nickname, Date.now()])[0]
      + (showUserId ? ` (${userId})` : '')
  }

  async function formatMessage(session: Session) {
    const codes = CQCode.parseAll(session.message)
    let output = ''
    for (const code of codes) {
      if (typeof code === 'string') {
        output += code
      } else if (code.type === 'at') {
        if (code.data.qq === 'all') {
          output += '@全体成员'
        } else {
          const id = +code.data.qq
          const timestamp = Date.now()
          if (!userMap[id] || timestamp - userMap[id][1] >= refreshUserName) {
            const promise = session.$bot
              .getGroupMemberInfo(session.groupId, id)
              .then(d => d.nickname, () => '' + id)
            userMap[id] = [promise, timestamp]
          }
          output += '@' + await userMap[id][0]
        }
      } else if (code.type === 'face') {
        output += `[face ${code.data.id}]`
      } else {
        output += `[${code.type}]`
      }
    }
    return output
  }

  ctx.on('connect', () => {
    Logger.lastTime = Date.now()
  })

  ctx.on('message', async (session) => {
    const groupName = await getGroupName(session)
    const senderName = getSenderName(session)
    const message = await formatMessage(session)
    logger.debug(`[${groupName}] ${senderName}: ${message}`)
  })
}
