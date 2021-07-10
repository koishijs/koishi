import { Adapter, App, Context, Time } from 'koishi'
import { WsClient, WsServer } from './ws'
import { CQBot } from './bot'
import HttpServer, { ResponsePayload } from './http'
import axios from 'axios'

interface OneBotOptions extends Adapter.WsClientOptions {
  path?: string
  secret?: string
  quickOperation?: number
  responseTimeout?: number
}

declare module '@koishijs/core' {
  interface AppOptions {
    onebot?: OneBotOptions
  }

  interface BotOptions {
    server?: string
  }

  interface Session {
    _response?: (payload: ResponsePayload) => void
  }

  namespace Bot {
    interface Platforms {
      onebot: CQBot
    }
  }
}

export * from './bot'
export * from './utils'
export * from './http'
export * from './ws'

App.defaultConfig.onebot = {
  responseTimeout: Time.minute,
}

Adapter.types['onebot:http'] = HttpServer
Adapter.types['onebot:ws'] = WsClient
Adapter.types['onebot:ws-reverse'] = WsServer
Adapter.types['onebot'] = Adapter.redirect((bot) => {
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
