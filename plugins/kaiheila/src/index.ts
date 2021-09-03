import { Adapter } from 'koishi'
import HttpServer from './http'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Loader {
    kaiheila: typeof import('.')
  }
}

export = Adapter.createPlugin('kaiheila', {
  'http': HttpServer,
  'ws': WebSocketClient,
}, config => config.verifyToken ? 'http' : 'ws')
