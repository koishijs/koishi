import axios, { AxiosError } from 'axios'
import FormData from 'form-data'
import { App, Adapter, Session } from 'koishi-core'
import { assertProperty, camelCase, Logger, segment } from 'koishi-utils'
import { TelegramBot } from './bot'
import Telegram from './interface'

const logger = new Logger('telegram')

function trimSlash(source: string) {
  return source.replace(/\/$/, '')
}

export default class HttpServer extends Adapter<'telegram'> {
  constructor(app: App) {
    super(app, TelegramBot)
    const config = this.app.options.telegram ||= {}
    config.path ||= '/telegram'
    config.endpoint = trimSlash(config.endpoint || 'https://api.telegram.org')
    config.selfUrl = trimSlash(assertProperty(config, 'selfUrl'))
  }

  private async _listen(bot: TelegramBot) {
    bot.ready = true
    const { endpoint, selfUrl, path, axiosConfig } = this.app.options.telegram
    bot._request = async (action, params, field, content, filename = 'file') => {
      const payload = new FormData()
      for (const key in params) {
        payload.append(key, params[key].toString())
      }
      if (field) payload.append(field, content, filename)
      const data = await axios.post(`${endpoint}/bot${bot.token}/${action}`, payload, {
        ...this.app.options.axiosConfig,
        ...axiosConfig,
        headers: payload.getHeaders(),
      }).then(res => {
        return res.data
      }).catch((e: AxiosError) => {
        return e.response.data
      })
      return data
    }
    const { username } = await bot.getLoginInfo()
    await bot.get('setWebhook', {
      url: selfUrl + path + '?token=' + bot.token,
      drop_pending_updates: true,
    })
    bot.username = username
    logger.debug('%d got version debug', bot.selfId)
    logger.debug('connected to %c', 'telegram:' + bot.selfId)
  }

  async listen() {
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
        // TODO convert video message
        let msg = message.text || ''
        msg += message.caption || ''
        if (message.photo) {
          const fid = message.photo[0].fileId
          const { data } = await axios.get(endpoint + '/bot' + token + `/getFile?file_id=${fid}`)
          msg += ` [CQ:image,file=${fid},url=${endpoint}/file/bot${token}/${data.result.file_path}]`
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
    await Promise.all(this.bots.map(bot => this._listen(bot)))
  }

  close() {
    logger.debug('http server closing')
  }
}
