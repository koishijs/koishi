import { Adapter } from 'koishi'
import { TelegramBot } from './bot'
import HttpServer from './http'

declare module 'koishi' {
  interface Modules {
    'adaper-telegram': typeof import('.')
  }
}

export = Adapter.define('telegram', TelegramBot, HttpServer)
