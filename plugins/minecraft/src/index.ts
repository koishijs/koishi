import { Adapter } from 'koishi'
import { MinecraftBot } from './bot'
import WsClient from './ws'
import * as mineflayer from 'mineflayer'
export * from './bot'

declare module 'koishi' {
  interface BotOptions extends Partial<mineflayer.BotOptions> {}

  namespace Bot {
    interface Platforms {
      minecraft: MinecraftBot
    }
  }
}

Adapter.types['minecraft'] = WsClient
