import { defineProperty, segment, Session } from 'koishi'
import { MatrixBot } from './bot'
import * as Matrix from './types'

export interface AdapterConfig { }

export function adaptSession(bot: MatrixBot, event: Matrix.ClientEvent) {
  const session: Partial<Session> = {}
  session.selfId = bot.selfId
  session.userId = event.sender
  session.guildId = event.room_id
  session.channelId = event.room_id
  session.messageId = event.event_id
  session.timestamp = event.origin_server_ts
  session.author = {
    userId: event.sender,
    username: event.sender,
  }
  if (event.type === 'm.room.message') {
    session.type = 'message'
    const content = (event.content as Matrix.M_ROOM_MESSAGE)
    switch (content.msgtype) {
      case 'm.text':
      case 'm.emote': {
        const newContent = content['m.new_content']
        const relatesTo = content['m.relates_to']
        if (newContent) {
          session.type = 'message-updated'
          session.messageId = relatesTo['event_id']
          session.content = newContent.body
          break
        }
        const reply = relatesTo?.['m.in_reply_to']
        if (reply) {
          const { event_id } = reply
          const body = content.body.substring(content.body.indexOf('\n\n') + 2)
          session.content = segment('quote', { id: event_id, channelId: event.room_id }) + body
          break
        }
        session.content = content.body
        break
      }
      case 'm.image':
      case 'm.file':
      case 'm.audio':
      case 'm.video': {
        const url = bot.internal.getAssetUrl((content as any).url)
        session.content = segment(content.msgtype.substring(2), { url })
        break
      }
      default: return
    }
    return session
  }
  switch (event.type) {
    case 'm.room.redaction':
      session.type = 'message-delete'
      session.messageId = (event as any).redacts
      break
    case 'm.room.member': {
      const memberEvent = event.content as Matrix.M_ROOM_MEMBER
      session.userId = (memberEvent as any).state_key
      session.operatorId = event.sender
      session.content = memberEvent.reason
      session.messageId = event.event_id
      switch (memberEvent.membership) {
        case 'join':
          session.type = 'group-member-added'
          break
        case 'leave':
          session.type = 'group-member-deleted'
          break
        case 'ban':
          session.type = 'group-member'
          session.subtype = 'ban'
          break
        default:
          session.type = event.type
      }
      break
    }
    default:
      session.type = event.type
  }
  return session
}

export function dispatchSession(bot: MatrixBot, event: Matrix.ClientEvent) {
  const payload = adaptSession(bot, event)
  if (!payload) return

  const session = new Session(bot, payload)
  defineProperty(session, 'matrix', Object.create(bot.internal))
  Object.assign(session.matrix, event)
  bot.adapter.dispatch(session)
}
