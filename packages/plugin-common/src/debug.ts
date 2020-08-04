import { Context, Session } from 'koishi-core'
import { Logger, CQCode, Time } from 'koishi-utils'

function formatMessage (message: string) {
  const codes = CQCode.parseAll(message)
  let output = ''
  for (const code of codes) {
    if (typeof code === 'string') {
      output += code
      continue
    }
    switch (code.type) {
      case 'at': output += `@${code.data.qq}`; break
      case 'face': output += `[face ${code.data.id}]`; break
      default: output += `[${code.type}]`
    }
  }
  return output
}

const groupMap: Record<number, [Promise<string>, number]> = {}

export interface DebugOptions {
  showUserId?: boolean
  showGroupId?: boolean
  refreshInterval?: number
}

export function apply (ctx: Context, config: DebugOptions = {}) {
  const { refreshInterval = Time.day, showUserId, showGroupId } = config
  const logger = Logger.create('message', true)
  Logger.levels.message = 3

  async function getGroupName (session: Session) {
    if (session.messageType === 'private') return '私聊'
    const { groupId: id, $bot } = session
    const timestamp = Date.now()
    if (!groupMap[id] || timestamp - groupMap[id][1] >= refreshInterval) {
      groupMap[id] = [$bot.getGroupInfo(id).then(d => d.groupName, () => '' + id), timestamp]
    }
    let output = await groupMap[id][0]
    if (showGroupId && output !== '' + id) {
      output += ` (${id})`
    }
    return output
  }

  function getSenderName ({ anonymous, sender, userId }: Session) {
    return anonymous
      ? anonymous.name + (showUserId ? ` (${anonymous.id})` : '')
      : (sender.card || sender.nickname) + (showUserId ? ` (${userId})` : '')
  }

  ctx.on('connect', () => {
    Logger.lastTime = Date.now()
  })

  ctx.on('message', async (session) => {
    const groupName = await getGroupName(session)
    const senderName = getSenderName(session)
    logger.debug(`[${groupName}] ${senderName}: ${formatMessage(session.message)}`)
  })
}
