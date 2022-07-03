import { Logger } from '@koishijs/utils'
import { Adapter } from 'koishi'
import { QQGuildBot } from './bot'
import { AdapterConfig, BotConfig } from './utils'

const logger = new Logger('qqguild')

export class WebSocketClient extends Adapter<BotConfig, AdapterConfig> {
  static schema = BotConfig

  async connect(bot: QQGuildBot) {
    Object.assign(bot, await bot.getSelf())
    await bot.$innerBot.startClient(bot.config.intents)
    bot.$innerBot.on('ready', bot.resolve.bind(bot))
    bot.$innerBot.on('message', msg => {
      const session = bot.adaptMessage(msg)
      if (session) {
        session.type = 'message'
        this.dispatch(session)
      }
    })
  }

  start() { }

  stop() {
    logger.debug('ws server closing')
  }
}
