import { Adapter } from 'koishi'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Loader {
    discord: typeof import('.')
  }
}

export = Adapter.createPlugin('discord', WebSocketClient)
