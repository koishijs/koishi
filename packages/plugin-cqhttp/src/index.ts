/* eslint-disable quote-props */

import { Server, Context } from 'koishi-core'
import HttpServer from './http'
import WsClient from './ws'
import WsServer from './ws-reverse'

export * from './api'

declare module 'koishi-core/dist/server' {
  interface ServerTypes {
    'http': typeof HttpServer
    'ws': typeof WsClient
    'ws-reverse': typeof WsServer
  }
}

Server.types['http'] = HttpServer
Server.types['ws'] = WsClient
Server.types['ws-reverse'] = WsServer

export function apply (ctx: Context) {
  ctx.on('adapt', () => {
    const { options } = ctx.app
    if (!options.type) {
      const { server } = options.bots.find(bot => bot.server)
      if (server) {
        options.type = server.split(':', 1)[0] as any
      } else if (options.port) {
        options.type = 'ws-reverse'
      }
    }
  })
}
