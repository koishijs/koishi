import { AxiosError } from 'axios'
import { Adapter, Session, camelCase, Logger, segment, sanitize, trimSlash, assertProperty, Context } from 'koishi'
import { BotConfig, TelegramBot } from './bot'
import * as Telegram from './types'
import FormData from 'form-data'
import { AdapterConfig } from './utils'

const logger = new Logger('telegram')

abstract class TelegramAdapter extends Adapter<BotConfig, AdapterConfig> {
  static schema = BotConfig
  bot: TelegramBot
  abstract connect(bot: TelegramBot): void
  abstract start(): void
  abstract stop(): void
  async onUpdate(update: Telegram.Update) {
    logger.debug('receive %s', JSON.stringify(update))
    const bot = this.bot
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

export default class HttpServer extends TelegramAdapter {
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

  async connect(bot: TelegramBot) {
    const { token } = bot.config
    const { path, selfUrl } = this.config
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
    await bot.get('/setWebhook', {
      url: selfUrl + path + '?token=' + token,
      dropPendingUpdates: true,
    })
    bot.username = username
    logger.debug('connected to %c', 'telegram:' + bot.selfId)
    bot.resolve()
  }

  async start() {
    const { path } = this.config
    this.ctx.router.post(path, async (ctx) => {
      const payload = camelCase<Telegram.Update>(ctx.request.body)
      const token = ctx.request.query.token as string
      const [selfId] = token.split(':')
      const bot = this.bots.find(bot => bot.selfId === selfId) as TelegramBot
      if (!(bot?.config.token === token)) return ctx.status = 403
      ctx.body = 'OK'
      await this.onUpdate(payload)
    })
  }

  stop() {
    logger.debug('http server closing')
  }
}
