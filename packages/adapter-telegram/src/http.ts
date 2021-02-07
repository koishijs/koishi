import { App, Server, Session } from 'koishi-core'
import { Logger } from 'koishi-utils'
import axios from 'axios'
import { TelegramBot } from './bot'
import Telegram from './interface'

export interface ResponsePayload {
  delete?: boolean
  ban?: boolean
  banDuration?: number
  kick?: boolean
  reply?: string
  autoEscape?: boolean
  atSender?: boolean
  approve?: boolean
  remark?: string
  reason?: string
}

declare module 'koishi-core/dist/session' {
  interface Session {
    _response?: (payload: ResponsePayload) => void
  }
}

const logger = new Logger('server')

export default class HttpServer extends Server<'telegram'> {
  constructor(app: App) {
    super(app, TelegramBot)
  }

  private async _listen(bot: TelegramBot) {
    bot.ready = true
    const { telegram = {} } = this.app.options
    const { url = 'https://api.telegram.org/', selfUrl } = telegram
    bot._request = async (action, params) => {
      const headers = { 'Contsent-Type': 'application/json' } as any
      const { data } = await axios.post(url + 'bot' + bot.token + '/' + action, params, { headers })
      return data
    }
    const { userId, username } = await bot.getLoginInfo()
    await bot.get('setWebhook', {
      url: selfUrl + 'webhook/telegram/' + userId + '/' + username + '/' + bot.token,
      drop_pending_updates: true,
    })
    bot.version = 'Telegram'
    logger.debug('%d got version info', bot.selfId)
    logger.info('connected to %c', 'telegram:' + bot.selfId)
  }

  async listen() {
    const { telegram = {} } = this.app.options
    const { url = 'https://api.telegram.org/' } = telegram
    this.app.router.post('/webhook/telegram/:selfId/:selfName/:token', async (ctx) => {
      ctx.body = '1'
      logger.info('receive %s', JSON.stringify(ctx.request.body))
      const payload = ctx.request.body as Telegram.Update
      const { token, selfId, selfName } = ctx.params
      const body: Partial<Session> = { selfId, platform: 'telegram' }
      if (payload.message) {
        const message = payload.message
        body.messageId = message.message_id.toString()
        body.type = 'message'
        body.subtype = message.chat.type === 'private' ? 'private' : 'group'
        body.timestamp = message.date
        // TODO convert video message
        let msg = message.text || ''
        msg += message.caption || ''
        if (message.photo) {
          const fid = message.photo[0].file_id
          const { data } = await axios.get(url + 'bot' + token + `/getFile?file_id=${fid}`)
          msg += ` [CQ:image,file=${fid},url=${url}file/bot${token}/${data.result.file_path}]`
        }
        for (const entity of message.entities || []) {
          if (entity.type === 'mention') {
            const name = msg.substr(entity.offset, entity.length)
            if (name === '@' + selfName) msg = msg.replace(name, `[CQ:at,qq=${selfId}]`)
            // TODO handle @others
          } else if (entity.type === 'text_mention') {
            msg = msg.replace(msg.substr(entity.offset, entity.length), `[CQ:at,qq=${entity.user.id}]`)
          }
        }
        body.content = body.rawMessage = msg
        body.userId = message.from.id.toString()
        body.groupId = message.chat.id.toString()
        body.channelId = body.subtype === 'private'
          ? 'private:' + body.userId
          : body.groupId
        body.author = {
          userId: message.from.id.toString(),
          nickname: message.from.username,
          username: message.from.username,
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
