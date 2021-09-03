import { Adapter } from 'koishi'
import HttpServer from './http'

declare module 'koishi' {
  interface Loader {
    telegram: typeof import('.')
  }
}

export = Adapter.createPlugin('telegram', HttpServer)
