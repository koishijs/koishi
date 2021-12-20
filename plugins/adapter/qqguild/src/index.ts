import { Adapter } from 'koishi'
import { QQGuildBot } from './bot'
import { WebSocketClient } from './ws'

declare module 'koishi' {
  interface Modules {
    'adapter-qqguild': typeof import('.')
  }
}

export * from '@qq-guild-sdk/core'
export default Adapter.define('qqguild', QQGuildBot, WebSocketClient)
