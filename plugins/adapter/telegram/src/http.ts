import { Adapter, assertProperty, Context, Dict, Logger, sanitize, Schema, segment, Session, trimSlash } from 'koishi'
import { BotConfig, TelegramBot } from './bot'
import * as Telegram from './types'
import { AdapterConfig, adaptUser } from './utils'

const logger = new Logger('telegram')

abstract class TelegramAdapter extends Adapter<BotConfig, AdapterConfig> {
  /** Init telegram updates listening */
  abstract listenUpdates(bot: TelegramBot): Promise<void>

  async connect(bot: TelegramBot): Promise<void> {
    const { username, userId, avatar, nickname } = await bot.getLoginInfo()
    bot.username = username
    bot.avatar = avatar
    bot.selfId = userId
    bot.nickname = nickname

    await this.listenUpdates(bot)
    logger.debug('connected to %c', 'telegram:' + bot.selfId)
    bot.resolve()
  }

  async onUpdate(update: Telegram.Update, bot: TelegramBot) {
    logger.debug('receive %s', JSON.stringify(update))
    const session: Partial<Session> = { selfId: bot.selfId }
    session.telegram = Object.create(bot.internal)
    Object.assign(session.telegram, update)

    function parseText(text: string, entities: Telegram.MessageEntity[]): segment[] {
      let curr = 0
      const segs: segment[] = []
      for (const e of entities) {
        const eText = text.substr(e.offset, e.length)
        let handleCurrent = true
        if (e.type === 'mention') {
          if (eText[0] !== '@') throw new Error('Telegram mention does not start with @: ' + eText)
          const atName = eText.slice(1)
          if (eText === '@' + bot.username) segs.push({ type: 'at', data: { id: bot.selfId, name: atName } })
          // TODO handle @others
        } else if (e.type === 'text_mention') {
          segs.push({ type: 'at', data: { id: e.user.id } })
        } else {
          handleCurrent = false
        }
        if (handleCurrent && e.offset > curr) {
          segs.push({ type: 'text', data: { content: text.slice(curr, e.offset) } })
          curr = e.offset + e.length
        }
      }
      if (curr < text?.length || 0) {
        segs.push({ type: 'text', data: { content: text.slice(curr) } })
      }
      return segs
    }
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post
    if (message) {
      session.messageId = message.message_id.toString()
      session.type = (update.message || update.channel_post) ? 'message' : 'message-updated'
      session.timestamp = message.date * 1000
      const segments: segment[] = []
      if (message.reply_to_message) {
        const replayText = message.reply_to_message.text || message.reply_to_message.caption
        const parsedReply = parseText(replayText, message.reply_to_message.entities || [])
        session.quote = {
          messageId: message.reply_to_message.message_id.toString(),
          author: adaptUser(message.reply_to_message.from),
          content: replayText ? segment.join(parsedReply) : undefined,
        }
        segments.push({ type: 'quote', data: { id: message.reply_to_message.message_id, channelId: message.reply_to_message.chat.id } })
      }
      if (message.location) {
        segments.push({
          type: 'location',
          data: { lat: message.location.latitude, lon: message.location.longitude },
        })
      }
      if (message.photo) {
        const photo = message.photo.sort((s1, s2) => s2.file_size - s1.file_size)[0]
        segments.push({ type: 'image', data: await bot.$getFileData(photo.file_id) })
      }
      if (message.sticker) {
        // TODO: Convert tgs to gif
        // https://github.com/ed-asriyan/tgs-to-gif
        // Currently use thumb only
        try {
          const file = await bot.internal.getFile({ file_id: message.sticker.file_id })
          if (file.file_path.endsWith('.tgs')) {
            throw new Error('tgs is not supported now')
          }
          segments.push({ type: 'image', data: await bot.$getFileContent(file.file_path) })
        } catch (e) {
          logger.warn('get file error', e)
          segments.push({ type: 'text', data: { content: `[${message.sticker.set_name || 'sticker'} ${message.sticker.emoji || ''}]` } })
        }
      } else if (message.animation) {
        segments.push({ type: 'image', data: await bot.$getFileData(message.animation.file_id) })
      } else if (message.voice) {
        segments.push({ type: 'audio', data: await bot.$getFileData(message.voice.file_id) })
      } else if (message.video) {
        segments.push({ type: 'video', data: await bot.$getFileData(message.video.file_id) })
      } else if (message.document) {
        segments.push({ type: 'file', data: await bot.$getFileData(message.document.file_id) })
      }

      const msgText: string = message.text || message.caption
      segments.push(...parseText(msgText, message.entities || []))

      session.content = segment.join(segments)
      session.userId = message.from.id.toString()
      session.author = adaptUser(message.from)
      session.channelId = message.chat.id.toString()
      if (message.chat.type === 'private') {
        session.subtype = 'private'
        session.channelId = 'private:' + session.channelId
      } else {
        session.subtype = 'group'
        session.guildId = session.channelId
      }
    } else if (update.chat_join_request) {
      session.timestamp = update.chat_join_request.date * 1000
      session.type = 'guild-member-request'
      session.messageId = `${update.chat_join_request.chat.id}@${update.chat_join_request.from.id}`
      // Telegram join request does not have text
      session.content = ''
      session.channelId = update.chat_join_request.chat.id.toString()
      session.guildId = session.channelId
    } else if (update.my_chat_member) {
      session.timestamp = update.my_chat_member.date * 1000
      session.messageId = `${update.my_chat_member.chat.id}@${update.my_chat_member.from.id}`
      session.content = ''
      session.channelId = update.my_chat_member.chat.id.toString()
      session.guildId = session.channelId
      if (update.my_chat_member.old_chat_member.user.id.toString() === bot.selfId) {
        if (update.my_chat_member.new_chat_member.status === 'left') {
          session.type = 'group-deleted'
        } else if (update.my_chat_member.old_chat_member.status === 'left') {
          session.type = 'group-added'
        }
      }
    }
    logger.debug('receive %o', session)
    this.dispatch(new Session(bot, session))
  }
}

export class HttpServer extends TelegramAdapter {
  static schema = BotConfig

  constructor(ctx: Context, config: AdapterConfig) {
    super(ctx, config)
    config.path = sanitize(config.path || '/telegram')
    if (config.selfUrl) {
      config.selfUrl = trimSlash(config.selfUrl)
    } else {
      config.selfUrl = assertProperty(ctx.app.options, 'selfUrl')
    }
  }

  async listenUpdates(bot: TelegramBot) {
    const { token } = bot.config
    const { path, selfUrl } = this.config
    const info = await bot.internal.setWebhook({
      url: selfUrl + path + '?token=' + token,
      drop_pending_updates: true,
    })
    if (!info) throw new Error('Set webhook failed')
    logger.debug('listening updates %c', 'telegram: ' + bot.selfId)
  }

  async start() {
    const { path } = this.config
    this.ctx.router.post(path, async (ctx) => {
      const payload: Telegram.Update = ctx.request.body
      const token = ctx.request.query.token as string
      const [selfId] = token.split(':')
      const bot = this.bots.find(bot => bot.selfId === selfId) as TelegramBot
      if (!(bot?.config?.token === token)) return ctx.status = 403
      ctx.body = 'OK'
      await this.onUpdate(payload, bot)
    })
  }

  stop() {
    logger.debug('http server closing')
  }
}

export class HttpPolling extends TelegramAdapter {
  static schema = Schema.intersect([
    BotConfig,
    Schema.object({
      pollingTimeout: Schema.union([
        Schema.natural(),
        Schema.transform(Schema.const(true as const), () => 60),
      ]).default(60).description('通过长轮询获取更新时请求的超时 (单位为秒)。'),
    }),
  ])

  private offset: Dict<number> = {}
  private isStopped: boolean

  start() {
    this.isStopped = false
  }

  stop() {
    this.isStopped = true
  }

  async listenUpdates(bot: TelegramBot): Promise<void> {
    const { selfId } = bot
    this.offset[selfId] = this.offset[selfId] || 0

    const { url } = await bot.internal.getWebhookInfo()
    if (url) {
      logger.warn('Bot currently has a webhook set up, trying to remove it...')
      await bot.internal.setWebhook({ url: '' })
    }

    // Test connection / init offset with 0 timeout polling
    const previousUpdates = await bot.internal.getUpdates({
      allowed_updates: [],
      timeout: 0,
    })
    previousUpdates.forEach(e => this.offset[selfId] = Math.max(this.offset[selfId], e.update_id))

    const polling = async () => {
      const updates = await bot.internal.getUpdates({
        offset: this.offset[selfId] + 1,
        timeout: bot.config.pollingTimeout,
      })
      for (const e of updates) {
        this.offset[selfId] = Math.max(this.offset[selfId], e.update_id)
        this.onUpdate(e, bot)
      }

      if (!this.isStopped) {
        setTimeout(polling, 0)
      }
    }
    polling()
    logger.debug('listening updates %c', 'telegram: ' + bot.selfId)
  }
}
