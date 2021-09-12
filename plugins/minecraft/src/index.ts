import { Adapter } from 'koishi'
import { MinecraftBot } from './bot'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Loader {
    minecraft: typeof import('.')
  }
}

export = Adapter.define('minecraft', MinecraftBot, WebSocketClient)
