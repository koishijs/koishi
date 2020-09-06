import { Server, Session, App, Context } from 'koishi-core'
import { Logger, Time } from 'koishi-utils'
import HttpServer from './http'
import WsClient from './ws'
import WsServer from './ws-reverse'
import axios from 'axios'

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    path?: string
    secret?: string
    preferSync?: boolean
    quickOperation?: number
  }
}

export * from './api'
export * from './channel'
export * from './http'
export * from './ws'
export * from './ws-reverse'

App.defaultConfig.quickOperation = 0.1 * Time.second

const logger = new Logger('server')

interface CQHTTP extends Server {}

class CQHTTP {
  constructor(app: App) {
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

Server.types['cqhttp:http'] = HttpServer
Server.types['cqhttp:ws'] = WsClient
Server.types['cqhttp:ws-reverse'] = WsServer
Server.types.cqhttp = CQHTTP
Server.types.undefined = CQHTTP

const { broadcast } = Context.prototype
const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/

Context.prototype.broadcast = async function (this: Context, ...args: any[]) {
  const index = Array.isArray(args[0]) ? 1 : 0
  let message = args[index] as string
  let output = ''
  let capture: RegExpExecArray
  // eslint-disable-next-line no-cond-assign
  while (capture = imageRE.exec(message)) {
    const [text, , url] = capture
    output += message.slice(0, capture.index)
    message = message.slice(capture.index + text.length)
    const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
    output += `[CQ:image,file=base64://${Buffer.from(data).toString('base64')}]`
  }
  args[index] = output + message
  return broadcast.apply(this, args)
}

Session.prototype.$send = async function $send(this: Session, message: string, autoEscape = false) {
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
    return this._response({ reply: session.message, autoEscape, atSender: false })
  }
  return ctxType === 'group'
    ? this.$bot.sendGroupMsgAsync(ctxId, message, autoEscape)
    : this.$bot.sendPrivateMsgAsync(ctxId, message, autoEscape)
}
