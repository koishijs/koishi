import { Adapter } from 'koishi'
import { BotConfig, FeishuBot } from './bot'

export class HttpServer extends Adapter<BotConfig> {
  public bots: FeishuBot[]

  async start() {}
  async stop() {}
}
