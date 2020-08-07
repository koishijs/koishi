import { Server, Session, App } from 'koishi-core'
import { Logger } from 'koishi-utils'
import HttpServer from './http'
import WsClient from './ws'
import WsServer from './ws-reverse'

export * from './api'
export * from './channel'
export * from './http'
export * from './ws'
export * from './ws-reverse'

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    token?: string
  }
}

Server.types['cqhttp:http'] = HttpServer
Server.types['cqhttp:ws'] = WsClient
Server.types['cqhttp:ws-reverse'] = WsServer

const logger = Logger.create('app')

interface CQHTTP extends Server {}

class CQHTTP {
  constructor (app: App) {
    const bot = app.options.bots.find(bot => bot.server)
    if (!bot) {
      logger.info('infer type as %c', 'cqhttp:ws-reverse')
      return new WsServer(app)
    }
    if (bot.server.startsWith('ws')) {
      logger.info('infer type as %c', 'cqhttp:ws')
      return new WsClient(app)
    } else {
      logger.info('infer type as %c', 'cqhttp:http')
      return new HttpServer(app)
    }
  }
}

// register default behavior
Server.types.cqhttp = CQHTTP
Server.types.undefined = CQHTTP

Session.prototype.$send = async function $send (this: Session, message: string, autoEscape = false) {
  if (!message) return
  let ctxId: number
  // eslint-disable-next-line no-cond-assign
  const ctxType = (ctxId = this.groupId) ? 'group' : (ctxId = this.userId) ? 'user' : null
  if (this.$app.options.preferSync) {
    ctxType === 'group'
      ? await this.$bot.sendGroupMsg(ctxId, message, autoEscape)
      : await this.$bot.sendPrivateMsg(ctxId, message, autoEscape)
    return
  }
  if (this._response) {
    const session = this.$bot.createSession(this.messageType, ctxType, ctxId, message)
    if (this.$app.bail(this, 'before-send', session)) return
    return this._response({ reply: message, autoEscape, atSender: false })
  }
  return ctxType === 'group'
    ? this.$bot.sendGroupMsgAsync(ctxId, message, autoEscape)
    : this.$bot.sendPrivateMsgAsync(ctxId, message, autoEscape)
}
