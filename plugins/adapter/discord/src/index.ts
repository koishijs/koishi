import { Adapter } from 'koishi'
import { DiscordBot } from './bot'
import WebSocketClient from './ws'

declare module 'koishi' {
  interface Modules {
    'adapter-discord': typeof import('.')
  }
}

export default Adapter.define('discord', DiscordBot, WebSocketClient)
