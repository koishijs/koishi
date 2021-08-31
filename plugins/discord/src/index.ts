import { Adapter } from 'koishi'
import WebSocketClient from './ws'

declare module 'koishi' {
  namespace Plugin {
    interface Library {
      'discord': typeof plugin
    }
  }
}

const plugin = Adapter.createPlugin('discord', WebSocketClient)

export = plugin
