import { Adapter } from 'koishi'
import { DiscordBot } from './bot'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Modules {
    discord: typeof import('.')
  }
}

export = Adapter.define('discord', DiscordBot, WebSocketClient)
