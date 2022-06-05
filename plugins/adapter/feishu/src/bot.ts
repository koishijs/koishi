import FormData from 'form-data'
import { createReadStream } from 'fs'
import { Adapter, Bot, Quester, Schema, segment } from 'koishi'
import { Internal, MessageContent } from './types'
import { AdapterConfig } from './utils'

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
  endpoint: string
  appId: string
  appSecret: string
}

type AssetType = 'image' | 'audio' | 'video' | 'file'

export const BotConfig = Schema.intersect([
  Schema.object({
    appId: Schema.string().required().description('机器人的应用 ID。'),
    appSecret: Schema.string().role('secret').required().description('机器人的应用密钥。'),
    encryptKey: Schema.string().role('secret').description('机器人的 Encrypt Key。'),
  }),
  Quester.createSchema({
    endpoint: 'https://open.feishu.cn/open-apis/',
  }),
])

export class FeishuBot extends Bot<BotConfig> {
  static schema = AdapterConfig
  _token?: string
  http: Quester
  internal: Internal

  constructor(adapter: Adapter, config: BotConfig) {
    super(adapter, config)

    this.selfId = config.appId

    this.http = adapter.ctx.http.extend({
      endpoint: config.endpoint,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })

    this.internal = new Internal(this.http)

    this.refreshToken()
  }

  private async refreshToken(): Promise<void> {
    const { tenant_access_token: token } = await this.internal.getTenantAccessToken({
      app_id: this.config.appId,
      app_secret: this.config.appSecret,
    })
    this.logger.debug('refreshed token %s', token)
    this.token = token
  }

  get token() {
    return this._token
  }

  set token(v: string) {
    this._token = v
    this.http.config.headers.Authorization = `Bearer ${v}`
  }

  async sendMessage(channelId: string, content: string, guildId?: string): Promise<string[]> {
    const session = await this.session({ channelId, content, guildId, subtype: guildId ? 'group' : 'private' })
    if (!session?.content) return []

    const chain = segment.parse(content)

    const messageIds: string[] = []
    let buffer: MessageContent.Text[] = []
    const sendBuffer = async () => {
      if (!buffer.length) return
      const { data } = await this.internal.sendMessage('open_id', {
        msg_type: 'text',
        content: JSON.stringify(buffer),
        receive_id: channelId,
      })
      buffer = []
      messageIds.push(data.message_id)
    }

    for (const message of chain) {
      const { type, data } = message
      switch (type) {
        case 'text':
          buffer.push({
            text: data.content,
          })
          break
        case 'at': {
          if (data.id) {
            buffer.push({
              text: `<at user_id="${data.id}">${data.name}</at>`,
            })
          } else if (data.type === 'all') {
            buffer.push({
              text: '<at user_id="all">all</at>',
            })
          } else if (data.type === 'here' || data.role) {
            this.logger.warn(`@here or @role{${data.role}} is not supported`)
          }
          break
        }
        case 'image':
        case 'audio':
        case 'video':
        case 'file': {
          await sendBuffer()
          const content = await this._prepareAssets(type, data)
          const { data: resp } = await this.internal.sendMessage('open_id', {
            content: JSON.stringify(content),
            // video is marked as 'media' in feishu platform
            // see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message/create_json#54406d84
            msg_type: type === 'video' ? 'media' : type,
            receive_id: channelId,
          })
          messageIds.push(resp.message_id)
          break
        }

        case 'sharp':
        case 'face':
          this.logger.warn(`${type} is not supported`)
          break
      }
    }

    // assume there are no more messages in the buffer.
    await sendBuffer()

    return messageIds
  }

  private async _prepareAssets(type: AssetType, data: any): Promise<MessageContent.Contents> {
    const payload = new FormData()

    const assetKey = type === 'image' ? 'image' : 'file'
    const [schema, file] = data.url.split('://')
    const filename = schema === 'base64' ? 'unknown' : data.url.split('/').pop()
    if (schema === 'file') {
      payload.append(assetKey, createReadStream(file))
    } else if (schema === 'base64') {
      payload.append(assetKey, Buffer.from(file, 'base64'))
    }

    if (type === 'image') {
      payload.append('image_type', 'message')
      const { data } = await this.internal.uploadImage(payload)
      return { image_key: data.image_key }
    } else {
      if (type === 'audio') {
        payload.append('file_type', 'opus')
      } else if (type === 'video') {
        payload.append('file_type', 'mp4')
      } else {
        const ext = filename.split('.').pop()
        if (['xls', 'ppt', 'pdf'].includes(ext)) {
          payload.append('file_type', ext)
        } else {
          payload.append('file_type', 'stream')
        }
      }
      payload.append('file_name', filename)
      const { data } = await this.internal.uploadFile(payload)
      return { file_key: data.file_key }
    }
  }
}
