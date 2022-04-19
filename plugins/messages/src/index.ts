import { Bot, Context, Logger, Service, Session } from 'koishi'
import { Message } from './types'
import snowflakes from './snowflakes'

declare module 'koishi' {
  interface Tables {
    message: Message
  }
  namespace Context {
    interface Services {
      messages: MessageDatabase
    }
  }
  interface EventMap {
    'messages/synced'(bot: Bot, channelId: string)
  }
}

const logger = new Logger('messages')

enum ChannelStatus {
  SYNCING, SYNCED
}

export class MessageDatabase extends Service {
  constructor(ctx: Context) {
    super(ctx, 'messages', true)
  }

  #status: Record<string, ChannelStatus> = {}
  #_queue: Partial<Session>[] = []
  #messageQueue: Record<string, Partial<Session>[]> = {}
  // platform:channelId, session.cid
  #queueRunning: boolean = true
  #messageRecord: Record<string, {
    inDb: string
    received: string
  }> = {}

  get #queue() {
    return this.#_queue
  }

  set #queue(arr) {
    this.#_queue = [...new Set(arr)]
    logger.debug('set queue %o', this.#_queue)
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

    // 如果是一个 platform 有多个 bot, bot 状态变化, 频道状态变化待解决
    this.ctx.on('message', this.#onMessage.bind(this))
    this.ctx.on('send', this.#onMessage.bind(this)) // TODO no userId and nickname(onebot) here
    this.#queueRunning = true
    setTimeout(this.#runQueue.bind(this), 1)
  }

  async stop() {
    this.#queueRunning = false
  }

  #addToSyncQueue(bot: Bot, guildId: string, channelId: string) {
    this.#queue.push(new Session(bot, {
      guildId,
      channelId,
    }))
  }

  async getMessages(bot: Bot, guildId: string, channelId: string) {
    if (this.#status[bot.platform + ':' + channelId] === ChannelStatus.SYNCED) {
      const data = await this.ctx.database.get('message', { platform: bot.platform, channelId }, {
        sort: {
          timestamp: 'desc',
        },
        limit: 50,
      })
      return data
    } else {
      this.#addToSyncQueue(bot, guildId, channelId)
    }
  }

  async #onGuildDeleted(session: Session) {
    // const { bot } = session
    // const channels = bot.getChannelList ? (await bot.getChannelList(session.guildId)).map(v => v.channelId) : [session.guildId]
    // delete this.#status[session.bot.platform + ':' + session.guildId]
  }

  async #runQueue() {
    while (this.#queueRunning) {
      if (!this.#queue.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      const session = this.#queue.shift()
      if (session) {
        logger.debug('queue item %o', session, session.cid)
        try {
          this.#status[session.cid] = ChannelStatus.SYNCING
          await this.#syncMessages(session.bot, session.guildId, session.channelId)
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
      userId: session.userId || session.author.userId,
      username: session.author.username,
      nickname: session.author.nickname,
      channelId: session.channelId,
      selfId: bot.selfId,
    }
  }

  async #syncMessages(bot: Bot, guildId: string, channelId: string) {
    logger.debug('channel %s', channelId)
    const cid = bot.platform + ':' + channelId
    if (bot.getChannelMessageHistory) {
      try {
        if (!this.#messageRecord[cid].inDb) {
          const messages = await bot.getChannelMessageHistory(channelId, this.#messageRecord[cid].received)
          this.ctx.database.upsert('message', messages.map(session => MessageDatabase.adaptMessage(session, bot, guildId)))
        } else {
          const inDatabase = await this.ctx.database.get('message', {
            id: this.#messageRecord[cid].inDb,
          })
          // 从新到旧查询
          let nowMessageId = this.#messageRecord[cid].received
          let newMessages = []

          while (true) {
            const messages = await bot.getChannelMessageHistory(channelId, nowMessageId)
            if (messages.find(v => v.messageId === inDatabase[0].messageId && v.messageId !== nowMessageId)) {
              // 这里会包含新发送的第一条消息 去个重
              newMessages = newMessages.concat(messages.filter(v => v.timestamp > inDatabase[0].timestamp.valueOf()
                && v.messageId !== nowMessageId))
              break
            }
            newMessages = newMessages.concat(messages.filter(v => v.messageId !== nowMessageId))
            nowMessageId = messages[0].messageId
          }
          logger.debug(newMessages)
          this.ctx.database.upsert('message', newMessages.map(session => MessageDatabase.adaptMessage(session, bot, guildId)))
        }
      } catch (e) {
        // 也许同步失败了需要删除已存数据库的数据?
        logger.error(e)
      }
    } else {
      logger.debug('channel %s dont have getChannelMessageHistory api, ignored', channelId)
    }

    const newLocal = this.#messageQueue[bot.platform + ':' + channelId]
    if (newLocal?.length) {
      this.ctx.database.upsert('message', newLocal.map(session => MessageDatabase.adaptMessage(session)))
      this.#messageQueue[bot.platform + ':' + channelId] = []
    }
    this.#status[bot.platform + ':' + channelId] = ChannelStatus.SYNCED
    bot.app.emit('messages/synced', bot, channelId)
  }

  async #onMessage(session: Session) {
    if (!this.#messageRecord[session.cid]) {
      const inDb = await this.ctx.database.get('message', {
        channelId: session.channelId,
      }, {
        sort: {
          timestamp: 'desc',
        },
        limit: 1,
      })
      this.#messageRecord[session.cid] = {
        inDb: inDb?.[0]?.id,
        received: session.messageId,
      }
      logger.debug('set message record, %o', this.#messageRecord)
    }
    // @TODO segments' base64://
    if (this.#status[session.cid] !== ChannelStatus.SYNCING) {
      logger.debug('on message, cid: %s, id: %s', session.cid, session.messageId)
      this.ctx.database.create('message', MessageDatabase.adaptMessage(session))
    } else {
      this.#messageQueue[session.cid] ||= []
      this.#messageQueue[session.cid].push(session)
      logger.debug('on message, cid: %s, id: %s, ignored, msg queue length: %d', session.cid, session.messageId, this.#messageQueue[session.cid].length)
    }
  }
}

export async function apply(ctx: Context) {
  ctx.plugin(MessageDatabase)
}

export * from './types'
