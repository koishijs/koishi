import { Adapter } from 'koishi'
import { MatrixBot } from './bot'
import { HttpAdapter } from './http'
import * as Matrix from './types'

declare module 'koishi' {
  interface Session { // TODO: Payload
      matrix: Matrix.Internal
  }
}

Adapter.define('matrix', MatrixBot, HttpAdapter)