import { Adapter } from 'koishi'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Loader {
    minecraft: typeof import('.')
  }
}

export = Adapter.createPlugin('minecraft', WebSocketClient)
