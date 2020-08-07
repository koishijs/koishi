/* eslint-disable quote-props */

import { Server, Context, Session } from 'koishi-core'
import HttpServer from './http'
import WsClient from './ws'
import WsServer from './ws-reverse'

export * from './api'

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    token?: string
  }

  interface ServerTypes {
    'http': typeof HttpServer
    'ws': typeof WsClient
    'ws-reverse': typeof WsServer
  }
}

Server.types['http'] = HttpServer
Server.types['ws'] = WsClient
Server.types['ws-reverse'] = WsServer

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
  if (this.$response) {
    const session = this.$bot.createSession(this.messageType, ctxType, ctxId, message)
    if (this.$app.bail(this, 'before-send', session)) return
    return this.$response({ reply: message, autoEscape, atSender: false })
  }
  return ctxType === 'group'
    ? this.$bot.sendGroupMsgAsync(ctxId, message, autoEscape)
    : this.$bot.sendPrivateMsgAsync(ctxId, message, autoEscape)
}
