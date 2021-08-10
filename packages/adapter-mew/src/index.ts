import { Adapter } from 'koishi-core'
import { AxiosRequestConfig } from 'axios'
import { MewBot } from './bot'
import { SocketIoClientImpl, SocketIOOption } from './ws'
import { Socket } from 'socket.io-client'
// import * as DC from './types'
export * from './bot'

interface MewOption extends SocketIOOption {
  axiosConfig?: AxiosRequestConfig
  subscribeNodes: string[]
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

  interface Bot {
    socketio: Socket
  }
}

Adapter.types['mew'] = SocketIoClientImpl
