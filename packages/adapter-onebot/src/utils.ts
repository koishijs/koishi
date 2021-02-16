import { CQBot, CQResponse, toVersion } from './bot'
import { Adapter, Session } from 'koishi-core'
import { Logger, camelCase, renameProperty, paramCase } from 'koishi-utils'

declare module 'koishi-core/dist/adapter' {
  interface BotOptions {
    server?: string
  }
}

const logger = new Logger('onebot')

export function createSession(server: Adapter, data: any) {
  const session = new Session(server.app, camelCase(data))
  renameProperty(session, 'type', 'postType')
  renameProperty(session, 'subtype', 'subType')
  session.platform = 'onebot'
  session.selfId = '' + session.selfId
  if (session.userId) session.userId = '' + session.userId
  if (session.groupId) session.groupId = session.channelId = '' + session.groupId
  if (session.targetId) session.targetId = '' + session.targetId
  if (session.operatorId) session.operatorId = '' + session.operatorId

  if (session.type === 'message') {
    CQBot.adaptMessage(session as any)
    renameProperty(session, 'subtype', 'messageType')
    session.channelId ||= `private:${session.userId}`
  } else if (data.post_type === 'request') {
    delete session['requestType']
    if (data.request_type === 'friend') {
      session.type = 'friend-request'
      session.channelId = `private:${session.userId}`
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
        session.subtype = paramCase(data.sub_type)
        session.subsubtype = paramCase(data.honor_type)
        break
    }
  } else return

  return session
}

let counter = 0
const listeners: Record<number, (response: CQResponse) => void> = {}

export function connect(bot: CQBot) {
  return new Promise<void>((resolve, reject) => {
    bot.ready = true

    bot.socket.on('message', (data) => {
      data = data.toString()
      let parsed: any
      try {
        parsed = JSON.parse(data)
      } catch (error) {
        return logger.warn('cannot parse message', data)
      }

      if ('post_type' in parsed) {
        logger.debug('receive %o', parsed)
        const session = createSession(bot.adapter, parsed)
        if (session) bot.adapter.dispatch(session)
      } else if (parsed.echo === -1) {
        bot.version = toVersion(camelCase(parsed.data))
        logger.debug('%d got version info', bot.selfId)
        if (bot.server) {
          logger.info('connected to %c', bot.server)
        }
        resolve()
      } else if (parsed.echo in listeners) {
        listeners[parsed.echo](parsed)
        delete listeners[parsed.echo]
      }
    })

    bot.socket.on('close', () => {
      delete bot._request
      bot.ready = false
    })

    bot.socket.send(JSON.stringify({
      action: 'get_version_info',
      echo: -1,
    }), (error) => {
      if (error) reject(error)
    })

    bot._request = (action, params) => {
      const data = { action, params, echo: ++counter }
      data.echo = ++counter
      return new Promise((resolve, reject) => {
        listeners[counter] = resolve
        setTimeout(() => {
          delete listeners[counter]
          reject(new Error('response timeout'))
        }, bot.app.options.onebot.responseTimeout)
        bot.socket.send(JSON.stringify(data), (error) => {
          if (error) reject(error)
        })
      })
    }
  })
}
