import { Adapter } from 'koishi-core'
import { MinecraftBot } from './bot'
import WsClient from './ws'
import * as mineflayer from 'mineflayer'
export * from './bot'

declare module 'koishi-core' {
  interface BotOptions extends Partial<mineflayer.BotOptions> {}

  namespace Bot {
    interface Platforms {
      minecraft: MinecraftBot
    }
  }
}

Adapter.types['minecraft'] = WsClient
