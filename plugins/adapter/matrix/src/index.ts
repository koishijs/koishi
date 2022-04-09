import { Adapter } from 'koishi'
import { MatrixBot } from './bot'
import { HttpAdapter } from './http'
import * as Matrix from './types'

declare module 'koishi' {
  interface Session {
      matrix: Matrix.Internal & Matrix.ClientEvent
  }
}

export default Adapter.define('matrix', MatrixBot, HttpAdapter)
