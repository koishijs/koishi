import { CQBot } from './bot'
import { Adapter, Session } from 'koishi-core'
import { Logger, camelCase, renameProperty, paramCase, segment } from 'koishi-utils'
import * as Koishi from 'koishi-core'
import * as OneBot from './types'

export * from './types'

export const adaptUser = (user: OneBot.AccountInfo): Koishi.UserInfo => ({
  userId: user.userId.toString(),
  username: user.nickname,
})

export const adaptGroupMember = (user: OneBot.SenderInfo): Koishi.GroupMemberInfo => ({
  ...adaptUser(user),
  nickname: user.card,
})

export const adaptAuthor = (user: OneBot.SenderInfo, anonymous?: OneBot.AnonymousInfo): Koishi.AuthorInfo => ({
  ...adaptUser(user),
  nickname: anonymous?.name || user.card,
  anonymous: anonymous?.flag,
})

function adaptContent(content: string) {
  return segment.parse(content).reduce((prev, { type, data }) => {
    if (type === 'at') {
      if (data.qq === 'all') return prev + '[CQ:at,type=all]'
      return prev + `[CQ:at,id=${data.qq}]`
    } else if (type === 'reply') {
      type = 'quote'
    }
    return prev + segment(type, data)
  }, '')
}

export const adaptMessage = (message: OneBot.Message): Koishi.MessageInfo => ({
  messageId: message.messageId.toString(),
  timestamp: message.time * 1000,
  content: adaptContent(message.message),
  author: adaptAuthor(message.sender, message.anonymous),
})

export const adaptGroup = (group: OneBot.GroupInfo): Koishi.GroupInfo => ({
  groupId: group.groupId.toString(),
  groupName: group.groupName,
})

export const adaptChannel = (group: OneBot.GroupInfo): Koishi.ChannelInfo => ({
  channelId: group.groupId.toString(),
  channelName: group.groupName,
})

export function toVersion(data: OneBot.VersionInfo) {
  const { coolqEdition, pluginVersion, goCqhttp, version } = data
  if (goCqhttp) {
    return `go-cqhttp/${version.slice(1)}`
  } else {
    return `coolq/${coolqEdition} cqhttp/${pluginVersion}`
  }
}

const logger = new Logger('onebot')

export function createSession(adapter: Adapter, data: any) {
  const session = camelCase<Session>(data)
  renameProperty(session, 'type', 'postType')
  renameProperty(session, 'subtype', 'subType')
  session.platform = 'onebot'
  session.selfId = '' + session.selfId
  if (session.userId) session.userId = '' + session.userId
  if (session.groupId) session.groupId = session.channelId = '' + session.groupId
  if (session.targetId) session.targetId = '' + session.targetId
  if (session.operatorId) session.operatorId = '' + session.operatorId

  if (session.type === 'message') {
    Object.assign(session, adaptMessage(session as any))
    renameProperty(session, 'subtype', 'messageType')
    session.channelId ||= `private:${session.userId}`
  } else if (data.post_type === 'request') {
    delete session['requestType']
    renameProperty(session, 'content', 'comment')
    renameProperty(session, 'messageId', 'flag')
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
        if (session.subtype === 'poke') {
          session.channelId ||= `private:${session.userId}`
        } else if (session.subtype === 'honor') {
          session.subsubtype = paramCase(data.honor_type)
        }
        break
    }
  } else return

  return new Session(adapter.app, session)
}

let counter = 0
const listeners: Record<number, (response: OneBot.Response) => void> = {}

export function connect(bot: CQBot) {
  return new Promise<void>((resolve, reject) => {
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
        Object.assign(bot, adaptUser(camelCase(parsed.data)))
        logger.debug('%d got self info', parsed.data)
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
    })

    bot.socket.send(JSON.stringify({
      action: 'get_login_info',
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
