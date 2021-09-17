import { AxiosError } from 'axios'
import { App, Adapter, Session, camelCase, Logger, segment, sanitize, trimSlash, assertProperty, Schema } from 'koishi'
import { TelegramBot } from './bot'
import * as Telegram from './types'
import FormData from 'form-data'

const logger = new Logger('telegram')

export interface TelegramConfig extends App.Config.Request {
  path?: string
  selfUrl?: string
}

export default class HttpServer extends Adapter<TelegramBot.Config, TelegramConfig> {
  static schema: Schema<TelegramConfig> = Schema.object({
    path: Schema.string('服务器监听的路径。').default('/telegram'),
    selfUrl: Schema.string('Koishi 服务暴露在公网的地址。缺省时将使用全局配置。'),
  })

  constructor(app: App, config: TelegramConfig) {
    super(app, config)
    config.path = sanitize(config.path || '/telegram')
    if (config.selfUrl) {
      config.selfUrl = trimSlash(config.selfUrl)
    } else {
      config.selfUrl = assertProperty(app.options, 'selfUrl')
    }

    this.http = app.http.extend({
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
      drop_pending_updates: true,
    })
    bot.username = username
    logger.debug('connected to %c', 'telegram:' + bot.selfId)
    bot.resolve()
  }

  async start() {
    const { path } = this.config
    this.app.router.post(path, async (ctx) => {
      logger.debug('receive %s', JSON.stringify(ctx.request.body))
      const payload = camelCase<Telegram.Update>(ctx.request.body)
      const token = ctx.request.query.token as string
      const [selfId] = token.split(':')
      const bot = this.bots.find(bot => bot.selfId === selfId) as TelegramBot
      if (!(bot?.config.token === token)) return ctx.status = 403

      ctx.body = 'OK'
      const body: Partial<Session> = { selfId }
      if (payload.message) {
        const message = payload.message
        body.messageId = message.messageId.toString()
        body.type = 'message'
        body.timestamp = message.date
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
        body.content = msg
        body.userId = message.from.id.toString()
        body.channelId = message.chat.id.toString()
        body.author = TelegramBot.adaptUser(message.from)
        if (message.chat.type === 'private') {
          body.subtype = 'private'
        } else {
          body.subtype = 'group'
          body.guildId = body.channelId
        }
      }
      logger.debug('receive %o', body)
      const session = new Session(bot, body)
      this.dispatch(session)
    })
  }

  stop() {
    logger.debug('http server closing')
  }
}
