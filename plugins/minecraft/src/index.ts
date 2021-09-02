import { Adapter } from 'koishi'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Loader {
    minecraft: typeof plugin
  }
}

const plugin = Adapter.createPlugin('minecraft', WebSocketClient)

export = plugin
