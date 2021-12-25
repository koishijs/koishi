import { Adapter } from 'koishi'
import { KaiheilaBot } from './bot'
import HttpServer from './http'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Modules {
    'adapter-kaiheila': typeof import('.')
  }
}

export default Adapter.define('kaiheila', KaiheilaBot, {
  'http': HttpServer,
  'ws': WebSocketClient,
}, config => config.verifyToken ? 'http' : 'ws')
