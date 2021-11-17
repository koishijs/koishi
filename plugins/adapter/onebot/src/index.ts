import { Adapter } from 'koishi'
import { OneBotBot } from './bot'
import { WebSocketClient, WebSocketServer } from './ws'
import { HttpServer } from './http'
import * as OneBot from './types'

declare module 'koishi' {
  interface Modules {
    'adapter-onebot': typeof import('.')
  }

  interface Session {
    onebot?: OneBot.Payload & OneBot.Internal
  }
}

export { OneBot }

export * from './bot'
export * from './ws'
export * from './http'

export default Adapter.define('OneBot', OneBotBot, {
  'http': HttpServer,
  'ws': WebSocketClient,
  'ws-reverse': WebSocketServer,
}, ({ endpoint }) => {
  return !endpoint ? 'ws-reverse' : endpoint.startsWith('ws') ? 'ws' : 'http'
})
