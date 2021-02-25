import { Adapter } from 'koishi-core'
import WsClient from './ws'

interface DiscordOptions extends Adapter.WsClientOptions {
  token?: string;
}

declare module 'koishi-core' {
  interface AppOptions {
    discord?: DiscordOptions
  }
}

Adapter.types['discord'] = WsClient
