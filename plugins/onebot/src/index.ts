import { Adapter, Context } from 'koishi'
import { CQBot } from './bot'
import { WebSocketClient, WebSocketServer } from './ws'
import { HttpServer } from './http'

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
  interface Module {
    onebot: typeof import('.')
  }
}

export = Adapter.define('onebot', CQBot, {
  'http': HttpServer,
  'ws': WebSocketClient,
  'ws-reverse': WebSocketServer,
}, ({ endpoint }) => {
  return !endpoint ? 'ws-reverse' : endpoint.startsWith('ws') ? 'ws' : 'http'
})
