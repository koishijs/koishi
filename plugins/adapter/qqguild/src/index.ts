import { Adapter } from 'koishi'
import { QQGuildBot } from './bot'
import { WebSocketClient } from './ws'

export * from '@qq-guild-sdk/core'

export default Adapter.define('qqguild', QQGuildBot, WebSocketClient)
