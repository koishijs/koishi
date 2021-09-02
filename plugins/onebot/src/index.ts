import { Adapter, Context } from 'koishi'
import { WebSocketClient, WebSocketServer } from './ws'
import HttpServer from './http'
import axios from 'axios'

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

declare module 'koishi' {
  interface Loader {
    onebot: typeof plugin
  }
}

const plugin = Adapter.createPlugin('onebot', {
  'http': HttpServer,
  'ws': WebSocketClient,
  'ws-reverse': WebSocketServer,
}, ({ server }) => !server ? 'ws-reverse' : server.startsWith('ws') ? 'ws' : 'http')

export = plugin
