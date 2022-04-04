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
    this.ctx.on('channel-updated', async (session) => {
      // 获取 channel list, 如果没有这个 channel 了, 说明权限无了, 取消监听, 反之
      const channels = await session.bot.getChannelList(session.guildId)
      const exist = Boolean(channels.find(v => v.channelId === session.channelId))
      if (!exist) {
        delete this.states[session.platform]?.[session.channelId]
      } else {
        await this.syncMessages(session.bot, session.guildId, session.channelId)
        this.states[session.platform][session.channelId] = true
      }
      console.log(session)
    })
    this.ctx.on('message', this.onMessage.bind(this))
  }

  async syncMessages(bot: Bot, guildId: string, channelId) {
    logger.info('channel %s', channelId)
    const existRecord = await this.ctx.database.get('message', {
      channelId,
    }, {
      limit: 1,
      sort: {
        timestamp: 'desc',
      },
    })
    const messages = await bot.getChannelMessageHistory(channelId)
    if (existRecord.length === 0) {
      this.ctx.database.upsert('message', messages.map(session => ({
        id: simpleflake(),
        messageId: session.messageId,
        content: session.content,
        platform: bot.platform,
        guildId: session.guildId || guildId, // eg. discord
        timestamp: new Date(session.timestamp),
        userId: session.userId,
        username: session.author.username,
        nickname: session.author.nickname,
        channelId: session.channelId,
        selfId: bot.selfId,
      })))
    } else {
      logger.info('last message id %s', existRecord[0].messageId)
      const msgInDb = messages.find(v => v.messageId === existRecord[0].messageId)
      let continued = Boolean(msgInDb)
      let nowMessageId = messages[0].messageId
      let newMessages = continued ? messages.filter(v => v.timestamp > existRecord[0].timestamp.valueOf()) : messages
      logger.info('msgInDb %o, nowMessageId %s, newMessages %o', existRecord[0], nowMessageId, newMessages)
      while (!continued) {
        logger.warn('now message id, %o', nowMessageId)
        try {
          const newlyMessages = await bot.getChannelMessageHistory(channelId, nowMessageId)
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
      // @TODO 粗糙解决一下消息重复的问题 修时间精度
      newMessages = newMessages.filter(v => v.messageId !== msgInDb.messageId)
      this.ctx.database.upsert('message', newMessages.map(session => ({
        id: simpleflake(),
        messageId: session.messageId,
        content: session.content,
        platform: bot.platform,
        guildId: session.guildId || guildId,
        timestamp: new Date(session.timestamp),
        userId: session.userId,
        username: session.author.username,
        nickname: session.author.nickname,
        channelId: session.channelId,
        selfId: bot.selfId,
      })))
    }
  }

  async onBotStatusUpdated(bot: Bot) {
    if (bot.disabled || bot.error || !bot.getChannelMessageHistory || bot.status !== 'online') {
      logger.info('on bot, ignored, %o, %o, %o, %s', bot.disabled, bot.error, bot.getChannelMessageHistory, bot.status)
      return
    }
    logger.info('on bot %s', bot.platform)
    for (const guild of await bot.getGuildList()) {
      const channels = bot.getChannelList ? (await bot.getChannelList(guild.guildId)).map(v => v.channelId) : [guild.guildId]
      for (const channel of channels) {
        try {
          await this.syncMessages(bot, guild.guildId, channel)

          this.states[bot.platform] ||= {}
          this.states[bot.platform][channel] = true
        } catch (e) {
          logger.error(e)
        }
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
