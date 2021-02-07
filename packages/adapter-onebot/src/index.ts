import { Server, App, Context } from 'koishi-core'
import { Time } from 'koishi-utils'
import HttpServer from './http'
import WsClient from './ws'
import WsServer from './ws-reverse'
import axios from 'axios'

interface OneBotOptions {
  path?: string
  secret?: string
  preferSync?: boolean
  quickOperation?: number
}

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    onebot?: OneBotOptions
  }
}

declare module 'koishi-core/dist/session' {
  namespace Session {
    interface Events {
      'lifecycle': {
        'enable': {}
        'disable': {}
        'connect': {}
        'heartbeat': {}
      }
    }
  }
}

export * from './bot'
export * from './socket'
export * from './http'
export * from './ws'
export * from './ws-reverse'

App.defaultConfig.onebot = {
  quickOperation: 0.1 * Time.second,
}

Server.types['onebot:http'] = HttpServer
Server.types['onebot:ws'] = WsClient
Server.types['onebot:ws-reverse'] = WsServer
Server.types['onebot'] = Server.redirect((bot) => {
  return !bot.server ? 'onebot:ws-reverse'
    : bot.server.startsWith('ws') ? 'onebot:ws'
      : 'onebot:http'
})

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
