import fileType from 'file-type'
import { createReadStream } from 'fs'
import { Adapter, assertProperty, Bot, camelCase, Dict, Logger, Quester, renameProperty, Schema, segment, snakeCase } from 'koishi'
import * as Telegram from './types'
import { AdapterConfig } from './utils'

const logger = new Logger('telegram')

const prefixTypes = ['quote', 'card', 'anonymous', 'markdown']

type TLAssetType =
  | 'photo'
  | 'audio'
  | 'document'
  | 'video'
  | 'animation'

export class SenderError extends Error {
  constructor(args: Dict<any>, url: string, retcode: number, selfId: string) {
    super(`Error when trying to send to ${url}, args: ${JSON.stringify(args)}, retcode: ${retcode}`)
    Object.defineProperties(this, {
      name: { value: 'SenderError' },
      selfId: { value: selfId },
      code: { value: retcode },
      args: { value: args },
      url: { value: url },
    })
  }
}

export interface TelegramResponse {
  ok: boolean
  result: any
}

export interface BotConfig extends Bot.BaseConfig {
  selfId?: string
  token?: string
  pollingInterval?: number
}

export const BotConfig: Schema<BotConfig> = Schema.object({
  token: Schema.string().description('机器人的用户令牌。').required(),
  pollingInterval: Schema.number().description('通过长轮询获取更新时间隔，单位为秒。设置即不使用 webhook 获取更新。'),
})

export interface TelegramBot {
  _request?(action: string, params: Dict<any>, field?: string, content?: Buffer, filename?: string): Promise<TelegramResponse>
}

async function maybeFile(payload: Dict<any>, field: TLAssetType): Promise<[any, string?, Buffer?, string?]> {
  if (!payload[field]) return [payload]
  let content
  let filename = 'file'
  const [schema, data] = payload[field].split('://')
  if (['base64', 'file'].includes(schema)) {
    content = (schema === 'base64' ? Buffer.from(data, 'base64') : createReadStream(data))
    delete payload[field]
  }
  // add file extension for base64 document (general file)
  if (field === 'document' && schema === 'base64') {
    const type = await fileType.fromBuffer(Buffer.from(data, 'base64'))
    if (!type) {
      logger.warn('Can not infer file mime')
    } else filename = `file.${type.ext}`
  }
  return [payload, field, content, filename]
}

async function isGif(url: string) {
  if (url.toLowerCase().endsWith('.gif')) return true
  const [schema, data] = url.split('://')
  if (schema === 'base64') {
    const type = await fileType.fromBuffer(Buffer.from(data, 'base64'))
    if (!type) {
      logger.warn('Can not infer file mime')
    } else if (type.ext === 'gif') return true
  }
  return false
}

export class TelegramBot extends Bot<BotConfig> {
  static adaptUser(data: Partial<Telegram.User & Bot.User>) {
    data.userId = data.id.toString()
    data.nickname = data.firstName + (data.lastName || '')
    delete data.id
    delete data.firstName
    delete data.lastName
    return data as Bot.User
  }

  static schema = AdapterConfig

  http: Quester

  constructor(adapter: Adapter, config: BotConfig) {
    assertProperty(config, 'token')
    if (!config.selfId) {
      if (config.token.includes(':')) {
        config.selfId = config.token.split(':')[0]
      } else {
        assertProperty(config, 'selfId')
      }
    }
    super(adapter, config)
    this.http = adapter.http.extend({
      endpoint: `${adapter.http.config.endpoint}/bot${config.token}`,
    })
  }

  /**
   * Request telegram API (using post method actually)
   * @param action method of telegram API, leading with a '/'
   * @param params params in camelCase
   * @param field file field key in fromData
   * @param content file stream
   * @returns Respond form telegram
   */
  async get<T = any, P = any>(action: string, params: P = undefined, field = '', content: Buffer = null, filename = 'file'): Promise<T> {
    this.logger.debug('[request] %s %o', action, params)
    const response = await this._request(action, snakeCase(params || {}), field, content, filename)
    this.logger.debug('[response] %o', response)
    const { ok, result } = response
    if (ok) return camelCase(result)
    throw new SenderError(params, action, -1, this.selfId)
  }

  private async _sendMessage(chatId: string, content: string) {


    const payload: Record<string, any> = { chatId, caption: '' }
    let currAssetType: TLAssetType = null
    let lastMsg: Telegram.Message = null

    const segs = segment.parse(content)
    let currIdx = 0
    while (currIdx < segs.length && prefixTypes.includes(segs[currIdx].type)) {
      if (segs[currIdx].type === 'quote') {
        payload.replyToMessage = true
      } else if (segs[currIdx].type === 'anonymous') {
        if (segs[currIdx].data.ignore === 'false') return null
      } else if (segs[currIdx].type === 'markdown') {
        payload.parseMode = 'MarkdownV2'
      }
      // else if (segs[currIdx].type === 'card') {}
      ++currIdx
    }

    const sendAsset = async () => {
      const assetApi = {
        photo: 'sendPhoto',
        audio: 'sendAudio',
        document: 'sendDocument',
        video: 'sendVideo',
        animation: 'sendAnimation',
      }
      lastMsg = await this.get(assetApi[currAssetType], ...await maybeFile(payload, currAssetType))
      currAssetType = null
      delete payload[currAssetType]
      delete payload.replyToMessage
      payload.caption = ''
    }

    for (const seg of segs.slice(currIdx)) {
      switch (seg.type) {
        case 'text':
          payload.caption += seg.data.content
          break
        case 'at': {
          const atTarget = seg.data.name || seg.data.id || seg.data.role || seg.data.type
          if (!atTarget) break
          payload.caption += `@${atTarget} `
          break
        }
        case 'sharp': {
          const sharpTarget = seg.data.name || seg.data.id
          if (!sharpTarget) break
          payload.caption += `#${sharpTarget} `
          break
        }
        case 'face':
          this.logger.info("Telegram don't support face")
          break
        case 'image':
        case 'audio':
        case 'video':
        case 'file': {
          // send previous asset if there is any
          if (currAssetType) await sendAsset()

          // handel current asset
          const assetUrl = seg.data.file || seg.data.url
          if (!assetUrl) {
            this.logger.warn('asset segment with no url')
            break
          }
          if (seg.type === 'image') currAssetType = await isGif(assetUrl) ? 'animation' : 'photo'
          else if (seg.type === 'file') currAssetType = 'document'
          else currAssetType = seg.type
          payload[currAssetType] = assetUrl
          break
        }
        default:
          this.logger.warn(`Unexpected asset type: ${seg.type}`)
          return
      }
    }

    // if something left in payload
    if (currAssetType) await sendAsset()
    if (payload.caption) lastMsg = await this.get('sendMessage', { chatId, text: payload.caption })

    return lastMsg ? lastMsg.messageId.toString() : null
  }

  async sendMessage(channelId: string, content: string) {
    if (!content) return
    const session = this.createSession({ content, channelId, subtype: 'group', guildId: channelId })
    if (await this.app.serial(session, 'before-send', session)) return
    session.messageId = await this._sendMessage(channelId, session.content)
    this.app.emit(session, 'send', session)
    return session.messageId
  }

  async sendPrivateMessage(userId: string, content: string) {
    return this.sendMessage(userId, content)
  }

  async getMessage() {
    return null
  }

  async deleteMessage(chatId: string, messageId: string) {
    await this.get('deleteMessage', { chatId, messageId })
  }

  static adaptGroup(data: Telegram.Chat & Bot.Guild): Bot.Guild {
    renameProperty(data, 'guildId', 'id')
    renameProperty(data, 'guildName', 'title')
    return data
  }

  async getGuild(chatId: string): Promise<Bot.Guild> {
    const data = await this.get('getChat', { chatId })
    return TelegramBot.adaptGroup(data)
  }

  async getGuildList() {
    return []
  }

  async getGuildMember(chatId: string, userId: string): Promise<Bot.GuildMember> {
    if (Number.isNaN(+userId)) return null
    const data = await this.get('getChatMember', { chatId, userId })
    return TelegramBot.adaptUser(data)
  }

  async getGuildMemberList(chatId: string): Promise<Bot.GuildMember[]> {
    const data = await this.get('getChatAdministrators', { chatId })
    return data.map(TelegramBot.adaptUser)
  }

  setGroupLeave(chatId: string) {
    return this.get('leaveChat', { chatId })
  }

  async getLoginInfo() {
    const data = await this.get<Telegram.User>('getMe')
    return TelegramBot.adaptUser(data)
  }
}
