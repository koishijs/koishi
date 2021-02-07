import { Server, Context } from 'koishi-core'
import HttpServer from './http'
import axios, { AxiosRequestConfig } from 'axios'

interface TelegramOptions {
  endpoint?: string
  path?: string
  selfUrl?: string
  axiosConfig?: AxiosRequestConfig
}

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    token?: string
  }
}

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    telegram?: TelegramOptions
  }
}

export * from './bot'
export * from './http'

Server.types.telegram = HttpServer
const { broadcast } = Context.prototype
const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/

Context.prototype.broadcast = async function boardcast(this: Context, ...args: any[]) {
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
