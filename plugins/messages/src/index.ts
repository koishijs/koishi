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
    logger.info('set queue %o', this.#_queue)
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

    // this.ctx.on('bot-status-updated', this.onBotStatusUpdated.bind(this))
    this.ctx.on('group-added', this.#onGroupChanged.bind(this))
    this.ctx.on('group-deleted', this.#onGroupChanged.bind(this))
    // this.ctx.on('channel-updated', async (session) => {
    //   // 获取 channel list, 如果没有这个 channel 了, 说明权限无了, 取消监听, 反之
    //   const channels = await session.bot.getChannelList(session.guildId)
    //   const exist = Boolean(channels.find(v => v.channelId === session.channelId))
    //   if (!exist) {
    //     if (this.#queue.find(v => v.cid === session.cid)) {
    //       this.#queue = this.#queue.filter(v => v.cid !== session.cid)
    //     } else {
    //       delete this.#syncing[session.cid]
    //     }
    //   } else {
    //     this.#queue.push(session)
    //   }
    // })
    this.ctx.on('message', this.#onMessage.bind(this))
    this.ctx.on('send', this.#onMessage.bind(this)) // TODO no userId and nickname(onebot) here
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
      this.addToSyncQueue(bot, guildId, channelId)
    }
  }

  async #onGroupChanged(session: Session) {
    const { bot } = session
    const channels = bot.getChannelList ? (await bot.getChannelList(session.guildId)).map(v => v.channelId) : [session.guildId]
    for (const channel of channels) {
      this.#queue.push(new Session(bot, {
        guildId: session.guildId,
        channelId: channel,
      }))
    }
  }

  async #runQueue() {
    while (this.#queueRunning) {
      if (!this.#queue.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      const session = this.#queue.shift()
      if (session) {
        logger.info('queue item %o', session, session.cid)
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
      userId: session.userId,
      username: session.author.username,
      nickname: session.author.nickname,
      channelId: session.channelId,
      selfId: bot.selfId,
    }
  }

  async #syncMessages(bot: Bot, guildId: string, channelId: string) {
    logger.info('channel %s', channelId)
    const cid = bot.platform + ':' + channelId
    if (bot.getChannelMessageHistory) {
      if (!this.#messageRecord[cid].inDb) {
        const messages = await bot.getChannelMessageHistory(channelId, this.#messageRecord[cid].received)
        // @TODO adapter(onebot) missing bot
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
        logger.info(newMessages)
        this.ctx.database.upsert('message', newMessages.map(session => MessageDatabase.adaptMessage(session, bot, guildId)))
      }
      this.#status[bot.platform + ':' + channelId] = ChannelStatus.SYNCED
    }

    const newLocal = this.#messageQueue[bot.platform + ':' + channelId]
    if (newLocal?.length) {
      this.ctx.database.upsert('message', newLocal.map(session => MessageDatabase.adaptMessage(session)))
      this.#messageQueue[bot.platform + ':' + channelId] = []
    }
  }

  async #onBotStatusUpdated(bot: Bot) {
    if (bot.disabled || bot.error || !bot.getChannelMessageHistory || bot.status !== 'online') {
      logger.info('on bot, ignored, %o, %o, %o, %s', bot.disabled, bot.error, bot.getChannelMessageHistory, bot.status)
      return
    }
    logger.info('on bot %s', bot.platform)
    for (const guild of await bot.getGuildList()) {
      const channels = bot.getChannelList ? (await bot.getChannelList(guild.guildId)).map(v => v.channelId) : [guild.guildId]
      for (const channel of channels) {
        this.#queue.push(new Session(bot, {
          guildId: guild.guildId,
          channelId: channel,
        }))
      }
    }
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
      logger.info('set message record, %o', this.#messageRecord)
    }
    // @TODO segments' base64://
    if (this.#status[session.cid] !== ChannelStatus.SYNCING) {
      logger.info('on message, cid: %s, id: %s', session.cid, session.messageId)
      this.ctx.database.create('message', MessageDatabase.adaptMessage(session))
    } else {
      this.#messageQueue[session.cid] ||= []
      this.#messageQueue[session.cid].push(session)
      logger.info('on message, cid: %s, id: %s, ignored, msg queue length: %d', session.cid, session.messageId, this.#messageQueue[session.cid].length)
    }
  }
}

export async function apply(ctx: Context) {
  ctx.plugin(MessageDatabase)
}

export * from './types'
