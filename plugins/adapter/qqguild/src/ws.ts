import { Bot as GBot, Message } from '@qq-guild-sdk/core'
import { Adapter, Schema, Session } from 'koishi'
import { BotConfig, QQGuildBot } from './bot'
import { Logger, segment } from '@koishijs/utils'

const logger = new Logger('qqguild')

export interface AdapterConfig extends Adapter.WebSocketClient.Config, Omit<GBot.Options, 'app'> {
}

export const AdapterConfig: Schema<AdapterConfig> = Schema.intersect([
  Schema.object({
    sandbox: Schema.boolean()
      .description('是否开启沙盒')
      .default(true),
    endpoint: Schema.string()
      .description('api 入口地址')
      .default('https://api.sgroup.qq.com/'),
    authType: Schema.union(['bot', 'bearer'])
      .description('验证方式')
      .default('bot'),
  }),
  Adapter.WebSocketClient.Config,
])

const createSession = (bot: QQGuildBot, msg: Message) => {
  const {
    id: messageId, guildId, channelId, timestamp,
  } = msg
  const session: Partial<Session> = {
    selfId: bot.selfId,
    guildId,
    messageId,
    channelId,
    timestamp: +timestamp,
  }
  session.guildId = msg.guildId
  session.channelId = msg.channelId
  session.subtype = 'group'
  session.content = msg.content
    .replace(/<@!(.+)>/, (_, $1) => segment.at($1))
    .replace(/<#(.+)>/, (_, $1) => segment.sharp($1))
  return new Session(bot, session)
}

export class WebSocketClient extends Adapter<BotConfig, AdapterConfig> {
  async connect(bot: QQGuildBot) {
    Object.assign(bot, await bot.getSelf())
    bot.resolve()
    await bot.$innerBot.startClient(bot.config.indents)
    bot.$innerBot.on('ready', bot.resolve)
    bot.$innerBot.on('message', msg => {
      const session = createSession(bot, msg)
      if (session) this.dispatch(session)
    })
  }

  start() { }

  stop() {
    logger.debug('ws server closing')
  }
}
