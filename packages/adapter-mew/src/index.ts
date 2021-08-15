import { Adapter } from 'koishi-core'
import { AxiosRequestConfig } from 'axios'
import { MewBot } from './bot'
import { SocketIoClientImpl, SocketIOOption } from './ws'
import { Socket } from 'socket.io-client'

export * from './bot'

interface MewOption extends SocketIOOption {
  axiosConfig?: AxiosRequestConfig
  endpoint?: string
}

declare module 'koishi-core' {
  interface AppOptions {
    mew?: MewOption
  }

  namespace Bot {
    interface Platforms {
      mew: MewBot
    }
  }

  interface BotOptions {
    subscribeNodes?: string[]
  }

  interface Bot {
    socketio: Socket
  }
}

Adapter.types['mew'] = SocketIoClientImpl
