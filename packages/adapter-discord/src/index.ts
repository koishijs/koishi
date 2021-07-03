import { Adapter } from 'koishi-core'
import { AxiosRequestConfig } from 'axios'
import { DiscordBot, HandleExternalAsset, HandleMixedContent } from './bot'
import WsClient from './ws'
import * as DC from './types'
export * from './bot'

interface DiscordOptions extends Adapter.WsClientOptions {
  endpoint?: string
  axiosConfig?: AxiosRequestConfig
  /**
   * 发送外链资源时采用的方法
   * - download：先下载后发送
   * - direct：直接发送链接
   * - auto：发送一个 HEAD 请求，如果返回的 Content-Type 正确，则直接发送链接，否则先下载后发送（默认）
   */
  handleExternalAsset?: HandleExternalAsset
  /**
   * 发送图文等混合内容时采用的方法
   * - separate：将每个不同形式的内容分开发送
   * - attach：图片前如果有文本内容，则将文本作为图片的附带信息进行发送（默认）
   */
  handleMixedContent?: HandleMixedContent
}

declare module 'koishi-core' {
  interface AppOptions {
    discord?: DiscordOptions
  }

  interface Session {
    discord?: {
      // eslint-disable-next-line camelcase
      webhook_id?: DC.snowflake
      flags: number
    }
  }

  namespace Bot {
    interface Platforms {
      discord: DiscordBot
    }
  }
}

Adapter.types['discord'] = WsClient
