import { Adapter } from 'koishi'
import { MinecraftBot } from './bot'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Modules {
    'adaper-minecraft': typeof import('.')
  }
}

export = Adapter.define('minecraft', MinecraftBot, WebSocketClient)
