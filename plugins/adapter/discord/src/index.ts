import { Adapter } from 'koishi'
import { DiscordBot } from './bot'
import * as Discord from './types'
import WebSocketClient from './ws'

export { Discord }

export * from './bot'
export * from './sender'
export * from './utils'
export * from './ws'

declare module 'koishi' {
  interface Session {
    discord?: Discord.GatewayPayload & Discord.Internal
  }
}

export default Adapter.define('discord', DiscordBot, WebSocketClient)
