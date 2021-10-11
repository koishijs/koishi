import { Adapter, Context } from 'koishi'
import { OneBotBot, BotConfig } from './bot'
import { WebSocketClient, WebSocketServer } from './ws'
import { HttpServer } from './http'
import * as OneBot from './types'

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
    const data = await this.http.get.arraybuffer(url)
    output += `[CQ:image,file=base64://${Buffer.from(data).toString('base64')}]`
  }
  args[index] = output + message
  return broadcast.apply(this, args)
}

declare module 'koishi' {
  interface Modules {
    'adaper-onebot': typeof import('.')
  }

  interface Session {
    onebot?: OneBot.Payload & OneBot.Internal
  }
}

const onebot = Adapter.define('onebot', OneBotBot, {
  'http': HttpServer,
  'ws': WebSocketClient,
  'ws-reverse': WebSocketServer,
}, ({ endpoint }) => {
  return !endpoint ? 'ws-reverse' : endpoint.startsWith('ws') ? 'ws' : 'http'
})

type _HttpServer = HttpServer
type _WebSocketClient = WebSocketClient
type _WebSocketServer = WebSocketServer

namespace onebot {
  export type Bot = OneBotBot
  export type HttpServer = _HttpServer
  export type WebSocketClient = _WebSocketClient
  export type WebSocketServer = _WebSocketServer
}

export = onebot
