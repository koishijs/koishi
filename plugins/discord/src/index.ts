import { Adapter } from 'koishi'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Loader {
    discord: typeof plugin
  }
}

const plugin = Adapter.createPlugin('discord', WebSocketClient)

export = plugin
