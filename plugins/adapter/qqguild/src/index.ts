import { Adapter } from 'koishi'
import { QQGuildBot } from './bot'
import { WebSocketClient } from './ws'

export * from '@qq-guild-sdk/core'

declare module 'koishi' {
  interface Modules {
    'adapter-qqguild': typeof import('.')
  }
}

export default Adapter.define('qqguild', QQGuildBot, WebSocketClient)
