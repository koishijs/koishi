import { Adapter } from 'koishi'
import WebSocketClient from './ws'

declare module 'koishi' {
  namespace Plugin {
    interface Library {
      'minecraft': typeof plugin
    }
  }
}

const plugin = Adapter.createPlugin('minecraft', WebSocketClient)

export = plugin
