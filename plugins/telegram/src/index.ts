import { Adapter } from 'koishi'
import HttpServer from './http'

declare module 'koishi' {
  interface Loader {
    telegram: typeof plugin
  }
}

const plugin = Adapter.createPlugin('telegram', HttpServer)

export = plugin
