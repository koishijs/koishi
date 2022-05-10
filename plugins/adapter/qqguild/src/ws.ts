import { Message } from '@qq-guild-sdk/core'
import * as QQGuild from '@qq-guild-sdk/core'
import { Logger, segment } from '@koishijs/utils'
import { Adapter, Session } from 'koishi'
import { QQGuildBot } from './bot'
import { AdapterConfig, adaptUser, BotConfig } from './utils'

const logger = new Logger('qqguild')

const createSession = (bot: QQGuildBot, msg: Message) => {
  const {
    id: messageId, author, guildId, channelId, timestamp,
  } = msg
  const session: Partial<Session> = {
    selfId: bot.selfId,
    guildId,
    messageId,
    channelId,
    timestamp: +timestamp,
  }
  session.author = adaptUser(msg.author)
  session.userId = author.id
  session.guildId = msg.guildId
  session.channelId = msg.channelId
  session.subtype = 'group'
  session.content = (msg.content ?? '')
    .replace(/<@!(.+)>/, (_, $1) => segment.at($1))
    .replace(/<#(.+)>/, (_, $1) => segment.sharp($1))
  session.content = (msg as any as { attachments: any[] }).attachments
    .filter(({ contentType }) => contentType.startsWith('image'))
    .reduce((content, attachment) => content + segment.image(attachment.url), session.content)
  return new Session(bot, session)
}

export class WebSocketClient extends Adapter<BotConfig, AdapterConfig> {
  static schema = BotConfig

  resolveIntents(intents: BotConfig['intents']): number {
    if (typeof intents === 'number') {
      return intents
    }
    return intents.reduce((sum, intent) => sum | QQGuild.Bot.Intents[intent], 0)
  }

  async connect(bot: QQGuildBot) {
    Object.assign(bot, await bot.getSelf())
    bot.resolve()
    await bot.$innerBot.startClient(this.resolveIntents(bot.config.intents))
    bot.$innerBot.on('ready', bot.resolve)
    bot.$innerBot.on('message', msg => {
      const session = createSession(bot, msg)
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
