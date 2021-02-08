import { Server } from 'koishi-core'
import HttpServer from './http'
import { AxiosRequestConfig } from 'axios'

interface TelegramOptions {
  endpoint?: string
  path?: string
  selfUrl?: string
  axiosConfig?: AxiosRequestConfig
}

declare module 'koishi-core/dist/server' {
  interface BotOptions {
    token?: string
  }
}

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    telegram?: TelegramOptions
  }
}

export * from './bot'
export * from './http'

Server.types.telegram = HttpServer
