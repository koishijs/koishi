import { Adapter } from 'koishi'
import HttpServer from './http'

declare module 'koishi' {
  namespace Plugin {
    interface Library {
      'telegram': typeof plugin
    }
  }
}

const plugin = Adapter.createPlugin('telegram', HttpServer)

export = plugin
