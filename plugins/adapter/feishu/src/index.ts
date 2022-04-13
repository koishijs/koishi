import { Adapter } from 'koishi'
import { FeishuBot } from './bot'
import { HttpServer } from './http'

declare module 'koishi' {
  interface Modules {
    'adapter-feishu': typeof import('.')
  }
}

export default Adapter.define('feishu', FeishuBot, {
  http: HttpServer,
}, () => 'http')
