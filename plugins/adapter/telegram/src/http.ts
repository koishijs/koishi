import axios, { AxiosError } from 'axios'
import FormData from 'form-data'
import { Adapter, assertProperty, camelCase, Context, Logger, sanitize, segment, Session, trimSlash } from 'koishi'
import { BotConfig, TelegramBot } from './bot'
import * as Telegram from './types'
import { AdapterConfig } from './utils'

const logger = new Logger('telegram')

type GetUpdatesOptions = {
  offset?: number
  limit?: number
  /** In seconds */
  timeout?: number
  allowedUpdates?: string[]
}

abstract class TelegramAdapter extends Adapter<BotConfig, AdapterConfig> {
  static schema = BotConfig

  constructor(ctx: Context, config: AdapterConfig) {
    super(ctx, config)
    this.config.request = this.config.request || {}
    this.config.request.endpoint = this.config.request.endpoint || 'https://api.telegram.org'
    this.http = ctx.http.extend(config.request)
  }

  abstract start(): void
  abstract stop(): void
  /** Init telegram updates listening */
  abstract listenUpdates(bot: TelegramBot): Promise<void>

  async connect(bot: TelegramBot): Promise<void> {
    bot._request = async (action, params, field, content, filename) => {
      const payload = new FormData()
      for (const key in params) {
        payload.append(key, params[key].toString())
      }
      if (field && content) payload.append(field, content, filename)
      try {
        return await bot.http.post(action, payload, payload.getHeaders())
      } catch (e) {
        return (e as AxiosError).response.data
      }
    }
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
    const { selfId, token } = bot.config
    const session: Partial<Session> = { selfId }

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
    const message = update.message || update.editedMessage || update.channelPost || update.editedChannelPost
    if (message) {
      session.messageId = message.messageId.toString()
      session.type = (update.message || update.channelPost) ? 'message' : 'message-updated'
      session.timestamp = message.date * 1000
      const segments: segment[] = []
      if (message.replyToMessage) {
        const replayText = message.replyToMessage.text || message.replyToMessage.caption
        const parsedReply = parseText(replayText, message.replyToMessage.entities || [])
        session.quote = {
          messageId: message.replyToMessage.messageId.toString(),
          author: TelegramBot.adaptUser(message.replyToMessage.from),
          content: replayText ? segment.join(parsedReply) : undefined,
        }
        segments.push({ type: 'quote', data: { id: message.replyToMessage.messageId } })
      }
      if (message.location) {
        segments.push({
          type: 'location',
          data: { lat: message.location.latitude, lon: message.location.longitude },
        })
      }
      const getFileData = async (fileId) => {
        try {
          const file = await bot.get<Telegram.File>('/getFile', { fileId })
          const downloadUrl = `${this.config.request.endpoint}/file/bot${token}/${file.filePath}`
          const res = await axios.get(downloadUrl, { responseType: 'arraybuffer' })
          const base64 = `base64://` + Buffer.from(res.data, 'binary').toString('base64')
          return { url: base64 }
        } catch (e) {
          logger.warn('get file error', e)
        }
      }
      if (message.photo) {
        const photo = message.photo.sort((s1, s2) => s2.fileSize - s1.fileSize)[0]
        segments.push({ type: 'image', data: await getFileData(photo.fileId) })
      }
      if (message.sticker) {
        // TODO: Convert tgs to gif
        // https://github.com/ed-asriyan/tgs-to-gif
        // Currently use thumb only
        segments.push({ type: 'text', data: { content: `[${message.sticker.setName || 'sticker'} ${message.sticker.emoji || ''}]` } })
      } else if (message.animation) segments.push({ type: 'image', data: await getFileData(message.animation.fileId) })
      else if (message.voice) segments.push({ type: 'audio', data: await getFileData(message.voice.fileId) })
      else if (message.video) segments.push({ type: 'video', data: await getFileData(message.video.fileId) })
      else if (message.document) segments.push({ type: 'file', data: await getFileData(message.document.fileId) })

      const msgText: string = message.text || message.caption
      segments.push(...parseText(msgText, message.entities || []))

      session.content = segment.join(segments)
      session.userId = message.from.id.toString()
      session.author = TelegramBot.adaptUser(message.from)
      if (message.chat.type === 'private') {
        session.subtype = 'private'
      } else {
        session.subtype = 'group'
        session.channelId = session.guildId = message.chat.id.toString()
      }
    } else if (update.chatJoinRequest) {
      session.timestamp = update.chatJoinRequest.date * 1000
      session.type = 'guild-member-request'
      session.messageId = `${update.chatJoinRequest.chat.id}@${update.chatJoinRequest.from.id}`
      // Telegram join request does not have text
      session.content = ''
      session.channelId = update.chatJoinRequest.chat.id.toString()
      session.guildId = session.channelId
    }
    logger.debug('receive %o', session)
    this.dispatch(new Session(bot, session))
  }
}

export class HttpServer extends TelegramAdapter {
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
    const info = await bot.get<boolean>('/setWebhook', {
      url: selfUrl + path + '?token=' + token,
      dropPendingUpdates: true,
    })
    if (!info) throw new Error('Set webhook failed')
    logger.debug('listening updates %c', 'telegram: ' + bot.selfId)
  }

  async start() {
    const { path } = this.config
    this.ctx.router.post(path, async (ctx) => {
      const payload = camelCase<Telegram.Update>(ctx.request.body)
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
  private offset: Record<string, number> = {}
  private isStopped: boolean

  start(): void {
    this.isStopped = false
  }

  stop(): void {
    this.isStopped = true
  }

  async listenUpdates(bot: TelegramBot): Promise<void> {
    const { selfId } = bot.config
    this.offset[selfId] = this.offset[selfId] || 0

    const { url } = await bot.get<Telegram.WebhookInfo, GetUpdatesOptions>('/getWebhookInfo', {})
    if (url) {
      logger.warn('Bot currently has a webhook set up, trying to remove it...')
      await bot.get<boolean>('/setWebhook', { url: '' })
    }

    // Test connection / init offset with 0 timeout polling
    const previousUpdates = await bot.get<Telegram.Update[], GetUpdatesOptions>('/getUpdates', {
      allowedUpdates: [],
      timeout: 0,
    })
    previousUpdates.forEach(e => this.offset[selfId] = Math.max(this.offset[selfId], e.updateId))

    const polling = async () => {
      const updates = await bot.get<Telegram.Update[], GetUpdatesOptions>('/getUpdates', {
        offset: this.offset[selfId] + 1,
        timeout: bot.config.pollingTimeout === true ? 60 : bot.config.pollingTimeout,
      })
      for (const e of updates) {
        this.offset[selfId] = Math.max(this.offset[selfId], e.updateId)
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
