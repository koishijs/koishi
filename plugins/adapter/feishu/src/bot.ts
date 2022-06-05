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
    const messages = await this._prepareMessage(chain)
    messages.forEach((message) => {
      this.internal.sendMessage('open_id', {
        content: message.content,
        msg_type: message.type,
        receive_id: channelId,
      })
    })
  }

  private async _prepareMessage(chain: segment.Chain): Promise<{ type: string; content: string }[]> {
    return (await Promise.all(chain
      .map(async ({ type, data }): Promise<{ type: string; content: MessageContent.Contents }> => {
        switch (type) {
          case 'text':
            return {
              type: 'text',
              content: {
                text: data.content,
              },
            }
          case 'at': {
            if (data.id) {
              return {
                type: 'text',
                content: {
                  text: `<at user_id="${data.id}">${data.name}</at>`,
                },
              }
            } else if (data.type === 'all') {
              return {
                type: 'text',
                content: {
                  text: '<at user_id="all">所有人</at>',
                },
              }
            } else if (data.type === 'here' || data.role) {
              this.logger.warn(`@here or @role{${data.role}} is not supported`)
            }
            break
          }
          case 'image':
          case 'audio':
          case 'video':
          case 'file':
            return {
              type,
              content: await this._prepareAssets(type, data),
            }

          case 'sharp':
          case 'face':
            this.logger.warn(`${type} is not supported`)
            break
        }
      })))
      .filter(({ content }) => typeof content !== 'undefined')
      .map(({ type, content }) => {
        return {
          type,
          content: JSON.stringify(content),
        }
      })
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
