import { Bot, Context, Logger, segment, Service, Session } from 'koishi'
import * as satori from '@satorijs/core'

export interface Message {
  id?: number
  content: string
  messageId: string
  platform: string
  guildId: string
  userId: string
  timestamp: Date
  quoteId?: string
  username: string
  nickname: string
  channelId: string
  selfId: string
  lastUpdated?: Date
  deleted?: number
}

declare module 'koishi' {
  interface Tables {
    message: Message
  }

  interface Context {
    messages: MessageService
  }

  interface Events {
    'messages/synced'(cid: string): void
    'messages/syncFailed'(cid: string, error: Error): void
    'messages/syncing'(cid: string): void
  }
}

const logger = new Logger('messages')

enum ChannelStatus {
  SYNCING,
  SYNCED,
  FAILED,
}

export class MessageService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'messages', true)

    this.ctx.model.extend('message', {
      id: 'integer',
      content: 'text',
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
      lastUpdated: 'timestamp',
      deleted: 'integer',
    }, {
      autoInc: true,
    })
  }

  #status: Record<string, ChannelStatus> = {}
  #_queue: Partial<Session>[] = []
  #messageQueue: Record<string, Partial<Session>[]> = {}
  // platform:channelId, session.cid
  #queueRunning: boolean = true
  #messageRecord: Record<string, {
    inDb: number
    received: string
  }> = {}

  #syncingItem: Partial<Session> = null

  get syncingItem() {
    return this.#syncingItem
  }

  get #queue() {
    return this.#_queue
  }

  set #queue(arr) {
    const ids = arr.map(o => o.cid)
    this.#_queue = arr.filter(({ cid }, index) => !ids.includes(cid, index + 1))
  }

  async start() {
    // 如果是一个 platform 有多个 bot, bot 状态变化, 频道状态变化待解决
    this.ctx.on('message', this.#onMessage.bind(this))
    this.ctx.on('send', async (session) => {
      const msg = await session.bot.getMessage(session.channelId, session.messageId)
      if (msg) {
        session.content = msg.content
      }
      await this.#onMessage(session)
    })
    this.ctx.on('message-deleted', async (session) => {
      await this.ctx.database.set('message', {
        messageId: session.messageId,
        platform: session.platform,
      }, {
        deleted: 1,
        lastUpdated: new Date(),
      })
    })
    this.ctx.on('message-updated', async (session) => {
      await this.ctx.database.set('message', {
        messageId: session.messageId,
        platform: session.platform,
      }, {
        content: session.content,
        lastUpdated: new Date(),
      })
    })

    // channel updated: 如果在队列内, 打断同步, 停止记录后续消息
    this.ctx.on('channel-updated', async (session) => {
      if (this.inSyncQueue(session.cid)) {
        logger.debug('in queue, removed, cid: %s', session.cid)
        this.removeFromSyncQueue(session.platform + ':' + session.channelId)
      }
    })
    // guild added: 如果 guildId 和 channelId 相同, 加入同步队列
    this.ctx.on('guild-added', async (session) => {
      if (session.channelId === session.guildId) {
        if (this.#status[session.cid] === ChannelStatus.SYNCED) {
          logger.debug('guild added, addToSyncQueue, cid: %s', session.cid)
          this.addToSyncQueue(session.bot, session.guildId, session.channelId)
        }
      }
    })
    this.#queueRunning = true
    setTimeout(this.#runQueue.bind(this), 1)
  }

  async stop() {
    this.#queueRunning = false
  }

  inSyncQueue(cid: string) {
    return this.#queue.filter(v => v.cid === cid).length > 0
  }

  addToSyncQueue(bot: Bot, guildId: string, channelId: string) {
    this.#queue.push(new Session(bot, {
      guildId,
      channelId,
    }))
  }

  removeFromSyncQueue(cid: string) {
    this.#queue = this.#queue.filter(v => v.cid !== cid)
  }

  async getMessages(bot: Bot, guildId: string, channelId: string): Promise<Partial<Session>[]> {
    const cid = bot.platform + ':' + channelId
    // 正在同步: 内存中的最后50条消息
    // 已同步: 数据库里拿
    // 未同步: 尝试同步, 数据库里拿
    logger.debug('get messages, status: %o', this.#status[cid])
    if (this.#status[cid] === ChannelStatus.SYNCING) {
      const queue = this.#messageQueue[cid]
      if (queue?.length) {
        return queue.slice(-50)
      }
      return []
    }
    if (this.#status[cid] !== ChannelStatus.SYNCED) {
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

  async #runQueue() {
    while (this.#queueRunning) {
      if (!this.#queue.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      const session = this.#queue[0]
      if (session) {
        this.#syncingItem = session
        logger.debug('queue item %o', session)
        this.ctx.app.emit('messages/syncing', session.cid)
        try {
          await this.#syncMessages(session.bot, session.guildId, session.channelId)
        } catch (e) {
          logger.error(e)
        }
        this.#queue.shift()
        this.#syncingItem = null
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

  async getMessageBetween(bot: Bot, channelId: string, from: string, to?: string): Promise<satori.Message[]> {
    // from: older, to: newer
    let toMessage: satori.Message
    if (!to) {
      logger.debug('!to')
      const latestMessages = await bot.getMessageList(channelId)
      to = latestMessages[latestMessages.length - 1].messageId
      toMessage = latestMessages[latestMessages.length - 1]
    } else {
      toMessage = await bot.getMessage(channelId, to)
    }
    logger.debug('from to %o %o', from, to)
    let nowMessageId = to
    let newMessages = []
    if (from === to) {
      return []
    }

    const fromMessageInDatabase = (await this.ctx.database.get('message', {
      platform: bot.platform,
      messageId: from,
    }))[0]
    // 如果后端没接收到（eg. gocq离线） 但是 koishi 在线时接收到了 要特殊处理
    if (fromMessageInDatabase?.timestamp.valueOf() > toMessage.timestamp) {
      logger.debug('ignored')
      return []
    }

    while (true) {
      if (!this.inSyncQueue(bot.platform + ':' + channelId)) {
        throw new Error('not in sync queue')
      }
      const messages = await bot.getMessageList(channelId, nowMessageId) // 从旧到新
      logger.debug('get history, now msg id: %s, newMessages length: %d', nowMessageId, newMessages.length)
      if (messages.find(v => v.messageId === from && v.messageId !== nowMessageId)) {
        // 找到了！
        const stopPosition = messages.findIndex(v => v.messageId === from)
        newMessages = newMessages.concat(messages.filter((v, i) => i > stopPosition && v.messageId !== to))
        break
      }
      if (messages[0].messageId === nowMessageId) {
        newMessages = newMessages.concat(messages)
        // 已经获取到了最早的消息 但是数据库中(或是 from 参数)有记录更早的消息 (可能是踢了又加了 guild) 判断为获取完成
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
    if (bot.getMessageList) {
      try {
        const inDatabase = await this.ctx.database.get('message', {
          channelId: channelId,
        }, {
          sort: {
            id: 'desc',
            timestamp: 'desc',
          },
          limit: 1,
        })
        if (!inDatabase.length) {
          const latestMessages = await bot.getMessageList(channelId)
          // 获取一次
          await this.ctx.database.upsert('message', latestMessages.map(session => MessageService.adaptMessage(session, bot, guildId)))
        } else {
          // 数据库中最后一条消息

          const newMessages = await this.getMessageBetween(bot, channelId, inDatabase[0].messageId, this.#messageRecord[cid]?.received)
          logger.debug('get new messages')
          if (newMessages.length) {
            await this.ctx.database.upsert('message', newMessages.map(session => MessageService.adaptMessage(session, bot, guildId)))
          }
        }
      } catch (e) {
        logger.error(e)
        this.#messageQueue[cid] = []
        bot.ctx.emit('messages/syncFailed', cid, e)
        this.removeFromSyncQueue(cid)
        this.#status[cid] = ChannelStatus.FAILED
        return
      }
    } else {
      logger.debug('channel %s dont have getMessageList api, ignored', channelId)
    }

    const newLocal = this.#messageQueue[cid]
    if (newLocal?.length) {
      await this.ctx.database.upsert('message', newLocal.map(session => MessageService.adaptMessage(session)))
      this.#messageQueue[cid] = []
    }
    this.#status[cid] = ChannelStatus.SYNCED
    bot.ctx.emit('messages/synced', cid)
    this.removeFromSyncQueue(cid)
  }

  async #onMessage(session: Session) {
    const { assignee } = await this.ctx.database.getChannel(session.platform, session.channelId, ['assignee'])
    if (assignee !== session.selfId) return
    if ((
      this.#status[session.cid] === ChannelStatus.SYNCED || this.#status[session.cid] === ChannelStatus.FAILED
    ) && !this.inSyncQueue(session.cid)) {
      logger.debug('on message, cid: %s, id: %s', session.cid, session.messageId)
      await this.ctx.database.create('message', MessageService.adaptMessage(session))
    } else if (this.inSyncQueue(session.cid)) {
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
