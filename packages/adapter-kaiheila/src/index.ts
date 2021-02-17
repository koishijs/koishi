import { Adapter } from 'koishi-core'
import HttpServer from './http'
import WsClient from './ws'

interface KaiheilaOptions extends Adapter.WsClientOptions {
  path?: string
  endpoint?: string
}

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    kaiheila?: KaiheilaOptions
  }
}

export * from './types'
export * from './utils'

Adapter.types['kaiheila:http'] = HttpServer
Adapter.types['kaiheila:ws'] = WsClient
Adapter.types['kaiheila'] = Adapter.redirect((bot) => {
  return bot.verifyToken ? 'kaiheila:http' : 'kaiheila:ws'
})
