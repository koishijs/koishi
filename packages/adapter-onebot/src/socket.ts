import { CQBot, CQResponse, toVersion } from './bot'
import { Server, Session } from 'koishi-core'
import { Logger, camelCase, renameProperty, paramCase } from 'koishi-utils'
import type WebSocket from 'ws'

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    server?: string
  }
}

const logger = new Logger('server')

export function createSession(server: Server, data: any) {
  const session = new Session(server.app, camelCase(data))
  renameProperty(session, 'type', 'postType')
  renameProperty(session, 'subtype', 'subType')
  session.platform = 'onebot'
  session.selfId = '' + session.selfId
  if (session.userId) session.userId = '' + session.userId
  if (session.groupId) session.groupId = '' + session.groupId
  if (session.targetId) session.targetId = '' + session.targetId
  if (session.operatorId) session.operatorId = '' + session.operatorId

  if (session.type === 'message') {
    CQBot.adaptMessage(session as any)
    renameProperty(session, 'subtype', 'messageType')
    session.channelId = session.subtype === 'group' ? session.groupId : `private:${session.userId}`
  } else if (data.post_type === 'meta_event') {
    delete session['metaEventType']
    session.type = 'lifecycle'
    if (data.meta_event_type === 'heartbeat') {
      session.subtype = 'heartbeat'
    }
  } else if (data.post_type === 'request') {
    delete session['requestType']
    if (data.request_type === 'friend') {
      session.type = 'friend-request'
    } else if (data.sub_type === 'add') {
      session.type = 'group-member-request'
    } else {
      session.type = 'group-request'
    }
  } else if (data.post_type === 'notice') {
    delete session['noticeType']
    switch (data.notice_type) {
      case 'group_recall':
        session.type = 'message-deleted'
        session.subtype = 'group'
        session.channelId = session.groupId
        break
      case 'friend_recall':
        session.type = 'message-deleted'
        session.subtype = 'private'
        session.channelId = `private:${session.userId}`
        break
      case 'friend_add':
        session.type = 'friend-added'
        break
      case 'group_upload':
        session.type = 'group-file-added'
        break
      case 'group_admin':
        session.type = 'group-member'
        session.subtype = 'role'
        break
      case 'group_ban':
        session.type = 'group-member'
        session.subtype = 'ban'
        break
      case 'group_decrease':
        session.type = session.userId === session.selfId ? 'group-deleted' : 'group-member-deleted'
        session.subtype = session.userId === session.operatorId ? 'active' : 'passive'
        break
      case 'group_increase':
        session.type = session.userId === session.selfId ? 'group-added' : 'group-member-added'
        session.subtype = session.userId === session.operatorId ? 'active' : 'passive'
        break
      case 'notify':
        session.type = 'notice'
        session.channelId = session.groupId
        session.subtype = paramCase(data.sub_type)
        session.subsubtype = paramCase(data.honor_type)
        break
    }
  }

  return session
}

let counter = 0

export default class Socket {
  private _listeners: Record<number, (response: CQResponse) => void> = {}

  constructor(private server: Server) {}

  connect = (resolve: (value: void) => void, reject: (error: Error) => void, bot: CQBot, socket: WebSocket) => {
    bot.ready = true

    socket.on('message', (data) => {
      data = data.toString()
      let parsed: any
      try {
        parsed = JSON.parse(data)
      } catch (error) {
        return logger.warn('cannot parse message', data)
      }

      if ('post_type' in parsed) {
        logger.debug('receive %o', parsed)
        const session = createSession(this.server, parsed)
        this.server.dispatch(session)
      } else if (parsed.echo === -1) {
        bot.version = toVersion(camelCase(parsed.data))
        logger.debug('%d got version info', bot.selfId)
        if (bot.server) {
          logger.info('connected to %c', bot.server)
        }
        resolve()
      } else {
        this._listeners[parsed.echo]?.(parsed)
      }
    })

    socket.on('close', () => {
      delete bot._request
      bot.ready = false
    })

    socket.send(JSON.stringify({
      action: 'get_version_info',
      echo: -1,
    }), (error) => {
      if (error) reject(error)
    })

    bot._request = (action, params) => {
      const data = { action, params, echo: ++counter }
      data.echo = ++counter
      return new Promise((resolve, reject) => {
        this._listeners[counter] = resolve
        socket.send(JSON.stringify(data), (error) => {
          if (error) reject(error)
        })
      })
    }
  }
}
