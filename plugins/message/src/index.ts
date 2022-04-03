import { Bot, Context, Logger, Service, Session } from 'koishi'
import { Message } from './types'
import { simpleflake } from 'simpleflakes'

declare module 'koishi' {
  interface Tables {
    message: Message
  }
  namespace Context {
    interface Services {
      msgdb: MessageDatabase
    }
  }
}

const logger = new Logger('message')

export class MessageDatabase extends Service {
  constructor(ctx: Context) {
    super(ctx, 'msgdb', true)
  }

  states = {}
  // platform.channelId

  async start() {
    this.ctx.model.extend('message', {
      id: 'string',
      content: 'string',
      platform: 'string',
      guildId: 'string',
      messageId: 'string',
      userId: 'string',
      timestamp: 'timestamp',
      quoteId: 'integer',
      username: 'string',
      nickname: 'string',
      channelId: 'string',
      selfId: 'string',
    }, {
      primary: 'id',
    })

    this.ctx.on('bot-status-updated', this.onBotStatusUpdated.bind(this))
    this.ctx.on('channel-added', (session) => {
      console.log(session)
    })
    this.ctx.on('message', this.onMessage.bind(this))
  }

  async onBotStatusUpdated(bot: Bot) {
    if (bot.disabled || bot.error || !bot.getChannelMessageHistory || bot.status !== 'online') {
      logger.info('on bot, ignored, %o, %o, %o, %s', bot.disabled, bot.error, bot.getChannelMessageHistory, bot.status)
      return
    }
    logger.info('on bot %o', bot)
    for (const guild of await bot.getGuildList()) {
      const channels = bot.getChannelList ? (await bot.getChannelList(guild.guildId)).map(v => v.channelId) : [guild.guildId]
      for (const channel of channels) {
        logger.info('channel %s', channel)
        const existRecord = await this.ctx.database.get('message', {
          channelId: channel,
        }, {
          limit: 1,
          sort: {
            timestamp: 'desc',
          },
        })
        try {
          const messages = await bot.getChannelMessageHistory(channel)
          console.log(messages)
          if (existRecord.length === 0) {
            this.ctx.database.upsert('message', messages.map(session => ({
              id: simpleflake(),
              messageId: session.messageId,
              content: session.content,
              platform: bot.platform,
              guildId: session.guildId || guild.guildId, // eg. discord
              timestamp: new Date(session.timestamp),
              userId: session.userId,
              username: session.author.username,
              nickname: session.author.nickname,
              channelId: session.channelId,
              selfId: bot.selfId,
            })))
          } else {
            logger.info('last message id %s', existRecord[0].messageId)
            let continued = Boolean(messages.find(v => v.messageId === existRecord[0].messageId))
            let nowMessageId = messages[0].messageId
            let newMessages = continued ? messages.filter(v => v.timestamp > existRecord[0].timestamp.valueOf()) : messages
            while (!continued) {
              logger.warn('now message id, %o', nowMessageId)
              try {
                const newlyMessages = await bot.getChannelMessageHistory(channel, nowMessageId)
                if (newMessages.find(v => v.messageId === existRecord[0].messageId)) {
                  continued = true
                  newMessages = newMessages.concat(newlyMessages.filter(v => v.timestamp > existRecord[0].timestamp.valueOf()))
                } else {
                  nowMessageId = newlyMessages[0].messageId

                  newMessages = newMessages.concat(newlyMessages)
                }
              } catch (e) {
                logger.error('got message error')
                continued = true
              }
            }
            logger.info('got messages, %o', newMessages)
            this.ctx.database.upsert('message', newMessages.map(session => ({
              id: simpleflake(),
              messageId: session.messageId,
              content: session.content,
              platform: bot.platform,
              guildId: session.guildId,
              timestamp: new Date(session.timestamp),
              userId: session.userId,
              username: session.author.username,
              nickname: session.author.nickname,
              channelId: session.channelId,
              selfId: bot.selfId,
            })))
          }
        } catch (e) {
          logger.error(e)
        }
        this.states[bot.platform] ||= {}
        this.states[bot.platform][channel] = true
      }
    }
  }

  async onMessage(session: Session) {
    if (this.states[session.bot.platform]?.[session.channelId]) {
      logger.info('on message, id: %s', session.messageId)
      this.ctx.database.create('message', {
        id: simpleflake(),
        messageId: session.messageId,
        content: session.content,
        platform: session.bot.platform,
        guildId: session.guildId,
        timestamp: new Date(session.timestamp),
        userId: session.userId,
        username: session.author.username,
        nickname: session.author.nickname,
        channelId: session.channelId,
        selfId: session.bot.selfId,
      })
    } else {
      logger.info('on message, id: %s, ignored', session.messageId)
    }
  }
}

export async function apply(ctx: Context) {
  ctx.plugin(MessageDatabase)
}

export * from './types'
