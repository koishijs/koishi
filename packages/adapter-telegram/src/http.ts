import axios from 'axios'
import { App, Adapter, Session, assertProperty, camelCase, Logger, segment, trimSlash, sanitize } from 'koishi-core'
import { TelegramBot } from './bot'
import * as Telegram from './types'

const logger = new Logger('telegram')

export default class HttpServer extends Adapter<'telegram'> {
  constructor(app: App) {
    super(app, TelegramBot)
    const config = app.options.telegram ||= {}
    config.path = sanitize(config.path || '/telegram')
    config.endpoint = trimSlash(config.endpoint || 'https://api.telegram.org')
    if (config.selfUrl) {
      config.selfUrl = trimSlash(config.selfUrl)
    } else {
      config.selfUrl = assertProperty(app.options, 'selfUrl')
    }
  }

  async start() {
    const { endpoint, path } = this.app.options.telegram
    this.app.router.post(path, async (ctx) => {
      logger.debug('receive %s', JSON.stringify(ctx.request.body))
      const payload = camelCase<Telegram.Update>(ctx.request.body)
      const token = ctx.request.query.token as string
      const [selfId] = token.split(':')
      const bot = this.bots[selfId]
      if (!(bot?.token === token)) return ctx.status = 403

      ctx.body = 'OK'
      const body: Partial<Session> = { selfId, platform: 'telegram' }
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
          const { data } = await axios.get(endpoint + '/bot' + token + `/getFile?file_id=${fid}`)
          msg += segment.image(`${endpoint}/file/bot${token}/${data.result.file_path}`)
        } else if (message.sticker) {
          const fid = message.sticker.fileId
          const { data } = await axios.get(endpoint + '/bot' + token + `/getFile?file_id=${fid}`)
          msg += segment.image(`${endpoint}/file/bot${token}/${data.result.file_path}`)
        } else if (message.animation) {
          const fid = message.animation.fileId
          const { data } = await axios.get(endpoint + '/bot' + token + `/getFile?file_id=${fid}`)
          msg += segment.image(`${endpoint}/file/bot${token}/${data.result.file_path}`)
        } else if (message.video) {
          const fid = message.video.fileId
          const { data } = await axios.get(endpoint + '/bot' + token + `/getFile?file_id=${fid}`)
          msg += segment.video(`${endpoint}/file/bot${token}/${data.result.file_path}`)
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
          body.groupId = body.channelId
        }
      }
      logger.debug('receive %o', body)
      const session = new Session(this.app, body)
      this.dispatch(session)
    })
    await Promise.all(this.bots.map(bot => bot._listen()))
  }

  stop() {
    logger.debug('http server closing')
  }
}
