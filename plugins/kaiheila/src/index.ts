import { Adapter } from 'koishi'
import { KaiheilaBot } from './bot'
import HttpServer from './http'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Modules {
    kaiheila: typeof import('.')
  }
}

export = Adapter.define('kaiheila', KaiheilaBot, {
  'http': HttpServer,
  'ws': WebSocketClient,
}, config => config.verifyToken ? 'http' : 'ws')
