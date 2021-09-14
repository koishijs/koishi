import { Adapter } from 'koishi'
import { TelegramBot } from './bot'
import HttpServer from './http'

declare module 'koishi' {
  interface Module {
    telegram: typeof import('.')
  }
}

export = Adapter.define('telegram', TelegramBot, HttpServer)
