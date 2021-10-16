import { Adapter } from 'koishi'
import { OneBotBot } from './bot'
import { WebSocketClient, WebSocketServer } from './ws'
import { HttpServer } from './http'
import * as OneBot from './types'

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
