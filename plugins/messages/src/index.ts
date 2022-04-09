import { Bot, Context, Logger, Service, Session } from 'koishi'
import { Message } from './types'
import snowflakes, { toTimestamp } from './snowflakes'

declare module 'koishi' {
  interface Tables {
    message: Message
  }
  namespace Context {
    interface Services {
      messages: MessageDatabase
    }
  }
}

const logger = new Logger('messages')

export class MessageDatabase extends Service {
  constructor(ctx: Context) {
    super(ctx, 'messages', true)
  }

  states: Record<string, boolean> = {}
  _queue: Partial<Session>[] = []
  messageQueue: Record<string, Partial<Session>[]> = {}
  // platform:channelId, session.cid

  get queue() {
    return this._queue
  }

  set queue(arr) {
    this._queue = [...new Set(arr)]
    logger.info('set queue %o', this._queue)
  }

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
    this.ctx.on('group-added', this.onGroupChanged.bind(this))
    this.ctx.on('group-deleted', this.onGroupChanged.bind(this))
    this.ctx.on('channel-updated', async (session) => {
      // 获取 channel list, 如果没有这个 channel 了, 说明权限无了, 取消监听, 反之
      const channels = await session.bot.getChannelList(session.guildId)
      const exist = Boolean(channels.find(v => v.channelId === session.channelId))
      if (!exist) {
        if (this.queue.find(v => v.cid === session.cid)) {
          this.queue = this.queue.filter(v => v.cid !== session.cid)
        } else {
          delete this.states[session.cid]
        }
      } else {
        this.queue.push(session)
      }
    })
    this.ctx.on('message', this.onMessage.bind(this))
    this.ctx.on('send', this.onMessage.bind(this)) // TODO no userId and nickname(onebot) here
    setTimeout(this.runQueue.bind(this), 1)
  }

  async onGroupChanged(session: Session) {
    const { bot } = session
    const channels = bot.getChannelList ? (await bot.getChannelList(session.guildId)).map(v => v.channelId) : [session.guildId]
    for (const channel of channels) {
      this.queue.push(new Session(bot, {
        guildId: session.guildId,
        channelId: channel,
      }))
    }
  }

  async runQueue() {
    while (true) {
      if (!this.queue.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      const session = this.queue.shift()
      if (session) {
        logger.info('queue item %o', session, session.cid)
        try {
          await this.syncMessages(session.bot, session.guildId, session.channelId)
          this.states[session.cid] = true
        } catch (e) {
          logger.error(e)
        }
      }
    }
  }

  static adaptMessage(session: Partial<Session>, bot: Bot = session.bot, guildId: string = session.guildId) {
    return {
      id: snowflakes().toString(),
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
    }
  }

  async syncMessages(bot: Bot, guildId: string, channelId: string) {
    logger.info('channel %s', channelId)
    if (bot.getChannelMessageHistory) {
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
        // @TODO adapter(onebot) missing bot
        this.ctx.database.upsert('message', messages.map(session => MessageDatabase.adaptMessage(session, bot, guildId)))
      } else {
        logger.info('last message id %s', existRecord[0].messageId)
        const existMessageInDb = messages.find(v => v.messageId === existRecord[0].messageId) // maybe null
        let continued = Boolean(existMessageInDb)
        let nowMessageId = messages[0].messageId
        let newMessages = continued ? messages.filter(v => v.timestamp > existRecord[0].timestamp.valueOf()) : messages
        logger.info('existMessageInDb %o, nowMessageId %s', existMessageInDb, nowMessageId)
        logger.info('newMessages %o', newMessages)
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
        newMessages = newMessages.filter(v => v.timestamp > (existMessageInDb ? toTimestamp(BigInt(v.messageId)) : 0))
        this.ctx.database.upsert('message', newMessages.map(session => MessageDatabase.adaptMessage(session, bot, guildId)))
      }
    }

    const newLocal = this.messageQueue[bot.platform + ':' + channelId]
    if (newLocal?.length) {
      this.ctx.database.upsert('message', newLocal.map(session => MessageDatabase.adaptMessage(session)))
      this.messageQueue[bot.platform + ':' + channelId] = []
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
        this.queue.push(new Session(bot, {
          guildId: guild.guildId,
          channelId: channel,
        }))
      }
    }
  }

  async onMessage(session: Session) {
    // @TODO segments' base64://
    if (this.states[session.cid]) {
      logger.info('on message, cid: %s, id: %s', session.cid, session.messageId)
      this.ctx.database.create('message', MessageDatabase.adaptMessage(session))
    } else {
      this.messageQueue[session.cid] ||= []
      this.messageQueue[session.cid].push(session)
      logger.info('on message, cid: %s, id: %s, ignored, msg queue length: %d', session.cid, session.messageId, this.messageQueue[session.cid].length)
    }
  }
}

export async function apply(ctx: Context) {
  ctx.plugin(MessageDatabase)
}

export * from './types'
