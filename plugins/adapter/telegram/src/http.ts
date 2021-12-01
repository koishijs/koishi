import { AxiosError } from 'axios'
import { Adapter, Session, camelCase, Logger, segment, sanitize, trimSlash, assertProperty, Context } from 'koishi'
import { BotConfig, TelegramBot } from './bot'
import * as Telegram from './types'
import FormData from 'form-data'
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
  abstract start(): void
  abstract stop(): void
  /** Init telegram updates listening */
  abstract listenUpdates(bot: TelegramBot): Promise<void>

  async connect(bot: TelegramBot): Promise<void> {
    bot._request = async (action, params, field, content, filename = 'file') => {
      const payload = new FormData()
      for (const key in params) {
        payload.append(key, params[key].toString())
      }
      if (field) payload.append(field, content, filename)
      const data = await bot.http.post(action, payload, payload.getHeaders()).then(res => {
        return res.data
      }).catch((e: AxiosError) => {
        return e.response.data
      })
      return data
    }
    const { username } = await bot.getLoginInfo()
    bot.username = username
    await this.listenUpdates(bot)
    logger.debug('connected to %c', 'telegram:' + bot.selfId)
    bot.resolve()
  }

  async onUpdate(update: Telegram.Update, bot: TelegramBot) {
    logger.debug('receive %s', JSON.stringify(update))
    const { selfId, token } = bot.config
    const session: Partial<Session> = { selfId }
    if (update.message) {
      const message = update.message
      session.messageId = message.messageId.toString()
      session.type = 'message'
      session.timestamp = message.date
      let msg
      if (message.text) {
        msg = message.text
      } else if (message.caption) {
        msg = message.caption
      } else {
        msg = ''
      }
      if (message.photo) {
        const fid = message.photo[0].fileId
        const data = await bot.http.get(`/getFile?file_id=${fid}`)
        msg += segment.image(`${this.config.request.endpoint}/file/bot${token}/${data.result.file_path}`)
      } else if (message.sticker) {
        const fid = message.sticker.fileId
        const data = await bot.http.get(`/getFile?file_id=${fid}`)
        msg += segment.image(`${this.config.request.endpoint}/file/bot${token}/${data.result.file_path}`)
      } else if (message.animation) {
        const fid = message.animation.fileId
        const data = await bot.http.get(`/getFile?file_id=${fid}`)
        msg += segment.image(`${this.config.request.endpoint}/file/bot${token}/${data.result.file_path}`)
      } else if (message.video) {
        const fid = message.video.fileId
        const data = await bot.http.get(`/getFile?file_id=${fid}`)
        msg += segment.video(`${this.config.request.endpoint}/file/bot${token}/${data.result.file_path}`)
      } else if (!message.text) {
        msg += '[Unsupported message]'
      }
      for (const entity of message.entities || []) {
        if (entity.type === 'mention') {
          const name = msg.substr(entity.offset, entity.length)
          if (name === '@' + bot.username) msg = msg.replace(name, segment.at(selfId))
          // TODO handle @others
        } else if (entity.type === 'text_mention') {
          msg = msg.replace(msg.substr(entity.offset, entity.length), segment.at(entity.user.id))
        }
      }
      session.content = msg
      session.userId = message.from.id.toString()
      session.channelId = message.chat.id.toString()
      session.author = TelegramBot.adaptUser(message.from)
      if (message.chat.type === 'private') {
        session.subtype = 'private'
      } else {
        session.subtype = 'group'
        session.guildId = session.channelId
      }
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

    this.http = ctx.http.extend({
      endpoint: 'https://api.telegram.org',
      ...config.request,
    })
  }

  async listenUpdates(bot: TelegramBot) {
    const { token } = bot.config
    const { path, selfUrl } = this.config
    const info = await bot.get<boolean>('/setWebhook', {
      url: selfUrl + path + '?token=' + token,
      dropPendingUpdates: true,
    })
    if (!info) throw new Error('Set webhook failed')
    logger.debug('connected to %c', 'telegram: ' + bot.selfId, 'WebhookInfo: ', info)
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
  constructor(ctx: Context, config: AdapterConfig) {
    super(ctx, config)
    this.http = ctx.http.extend({
      endpoint: 'https://api.telegram.org',
      ...config.request,
    })
  }

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
    }
    await bot.get<boolean>('/setWebhook', { url: '' })

    // Test connection / init offset with 0 timeout polling
    const previousUpdates = await bot.get<Telegram.Update[], GetUpdatesOptions>('/getUpdates', {
      allowedUpdates: [],
      timeout: 0,
    })
    previousUpdates.forEach(e => this.offset[selfId] = Math.max(this.offset[selfId], e.updateId))

    const polling = async () => {
      const updates = await bot.get<Telegram.Update[], GetUpdatesOptions>('/getUpdates', {
        offset: this.offset[selfId] + 1,
        timeout: 30,
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
    logger.debug('connected to %c', 'telegram: ' + bot.selfId)
  }
}
