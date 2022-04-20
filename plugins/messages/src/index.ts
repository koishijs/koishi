import { Bot, Context, Logger, segment, Service, Session } from 'koishi'
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
    'messages/syncFailed'(bot: Bot, channelId: string, error: Error)
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
    const ids = arr.map(o => o.cid)
    this.#_queue =arr.filter(({cid}, index) => !ids.includes(cid, index + 1))
    //logger.debug('set queue %o', this.#_queue)
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
      quoteId: 'string',
      username: 'string',
      nickname: 'string',
      channelId: 'string',
      selfId: 'string',
    }, {
      primary: 'id',
    })

    // 如果是一个 platform 有多个 bot, bot 状态变化, 频道状态变化待解决
    this.ctx.on('message', this.#onMessage.bind(this))
    this.ctx.on('send', this.#onMessage.bind(this))
    this.#queueRunning = true
    setTimeout(this.#runQueue.bind(this), 1)
  }

  async stop() {
    this.#queueRunning = false
  }

  addToSyncQueue(bot: Bot, guildId: string, channelId: string) {
    this.#queue.push(new Session(bot, {
      guildId,
      channelId,
    }))
  }

  removeFromSyncQueue(bot: Bot, guildId: string, channelId: string){
    delete this.#status[bot.platform + ':' + channelId]
    this.#queue = this.#queue.filter(v => v.cid !== (bot.platform + ':' + channelId))
    // 如果正在同步的话 怎么处理呢
  }

  async getMessages(bot: Bot, guildId: string, channelId: string): Promise<Partial<Session>[]> {
    // 正在同步: 内存中的最后50条消息
    // 已同步: 数据库里拿
    // 未同步: 尝试同步, 数据库里拿
    logger.debug('get messages, status: %o', this.#status[bot.platform + ':' + channelId])
    if (this.#status[bot.platform + ':' + channelId] === ChannelStatus.SYNCING) {
      const queue = this.#messageQueue[bot.platform + ':' + channelId]
      if (queue?.length) {
        return queue.slice(-50)
      }
      return []
    }
    if (this.#status[bot.platform + ':' + channelId] !== ChannelStatus.SYNCED) {
      this.addToSyncQueue(bot, guildId, channelId)
    }
    const data = await this.ctx.database.get('message', { platform: bot.platform, channelId }, {
      sort: {
        timestamp: 'desc',
      },
      limit: 50,
    })
    return data.map(v => new Session(bot, {
      timestamp: v.timestamp.valueOf(),
      channelId: v.channelId,
      guildId: v.guildId,
      author: {
        userId: v.userId,
        nickname: v.nickname,
        username: v.username,
      },
      content: v.content,
    }))
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
        logger.debug('queue item %o', session)
        try {
          await this.#syncMessages(session.bot, session.guildId, session.channelId)
        } catch (e) {
          logger.error(e)
        }
      }
    }
  }

  static adaptMessage(session: Partial<Session>, bot: Bot = session.bot, guildId: string = session.guildId): Message {
    const seg = segment.parse(session.content)
    const quote = seg.find(v => v.type === 'quote')
    if (quote) {
      session.content = session.content.slice(quote.capture[0].length)
    }
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
      quoteId: quote?.data?.id || null,
    }
  }

  async getMessageBetween(bot: Bot, channelId: string, from: string, to?: string): Promise<Bot.Message[]> {
    if (!to) {
      const latestMessages = await bot.getChannelMessageHistory(channelId)
      to = latestMessages[latestMessages.length - 1].messageId
    }
    logger.info('from to %o %o', from, to)
    let nowMessageId = to
    let newMessages = []
    if(from === to){
      return []
    }
    while (true) {
      const messages = await bot.getChannelMessageHistory(channelId, nowMessageId) // 从旧到新
      if (messages.find(v => v.messageId === from && v.messageId !== nowMessageId)) {
        // 找到了！
        const stopPosition = messages.findIndex(v => v.messageId === from)
        newMessages = newMessages.concat(messages.filter((v, i) => i > stopPosition && v.messageId !== to))
        break
      }
      newMessages = newMessages.concat(messages.filter(v => v.messageId !== to))
      nowMessageId = messages[0].messageId
    }
    return newMessages
  }

  async #syncMessages(bot: Bot, guildId: string, channelId: string) {
    logger.debug('channel %s', channelId)
    const cid = bot.platform + ':' + channelId

    this.#status[cid] = ChannelStatus.SYNCING
    // 已经收到新消息: 数据库中 到 新消息
    // 没有收到新消息: 数据库中 到 现在
    // 没有数据库消息: 获取一次
    if (bot.getChannelMessageHistory) {
      try {
        const inDatabase = await this.ctx.database.get('message', {
          channelId: channelId,
        }, {
          sort: {
            id: 'desc',
          },
          limit: 1,
        })
        if (!inDatabase.length) {
          const latestMessages = await bot.getChannelMessageHistory(channelId)
          // 获取一次
          await this.ctx.database.upsert('message', latestMessages.map(session => MessageDatabase.adaptMessage(session, bot, guildId)))
        } else {
          // 数据库中最后一条消息

          let newMessages = await this.getMessageBetween(bot, channelId, inDatabase[0].messageId, this.#messageRecord[cid]?.received)
          logger.info('get new messages')
          if( newMessages.length){
            await this.ctx.database.upsert('message', newMessages.map(session => MessageDatabase.adaptMessage(session, bot, guildId)))
          }
        }
      } catch (e) {
        logger.error(e)
        this.#messageQueue[cid] = []
        bot.app.emit('messages/syncFailed', bot, channelId, e)
        this.#queue = this.#queue.filter(v => v.cid !== cid)

        return
      }
    } else {
      logger.debug('channel %s dont have getChannelMessageHistory api, ignored', channelId)
    }

    const newLocal = this.#messageQueue[cid]
    if (newLocal?.length) {
      await this.ctx.database.upsert('message', newLocal.map(session => MessageDatabase.adaptMessage(session)))
      this.#messageQueue[cid] = []
    }
    this.#status[cid] = ChannelStatus.SYNCED
    bot.app.emit('messages/synced', bot, channelId)
  }

  async #onMessage(session: Session) {
    // @TODO segments' base64://
    if (this.#status[session.cid] === ChannelStatus.SYNCED) {
      logger.debug('on message, cid: %s, id: %s', session.cid, session.messageId)
      await this.ctx.database.create('message', MessageDatabase.adaptMessage(session))
    } else if(this.#queue.find(v => v.cid === session.cid)){
      // in queue, not synced
      if (!this.#messageRecord[session.cid]) {
        const inDb = await this.ctx.database.get('message', {
          channelId: session.channelId,
        }, {
          sort: {
            id: 'desc',
          },
          limit: 1,
        })
        this.#messageRecord[session.cid] = {
          inDb: inDb?.[0]?.id,
          received: session.messageId,
        }
      }
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
