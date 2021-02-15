import { Server } from 'koishi-core'
import HttpServer from './http'
import WsClient from './ws'

interface KaiheilaOptions extends Server.WsClientOptions {
  path?: string
  endpoint?: string
}

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    kaiheila?: KaiheilaOptions
  }
}

Server.types['kaiheila:http'] = HttpServer
Server.types['kaiheila:ws'] = WsClient
Server.types['kaiheila'] = Server.redirect((bot) => {
  return bot.verifyToken ? 'kaiheila:http' : 'kaiheila:ws'
})
