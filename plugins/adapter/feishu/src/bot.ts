import { Adapter, Bot, omit, Quester, Schema } from 'koishi'
import { AdapterConfig } from './utils'

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
  endpoint: string
  appId: string
  appSecret: string
}

export const BotConfig = Schema.object({
  endpoint: Schema.string().required().description('机器人的终结点。'),
  appId: Schema.string().required().description('机器人的应用 ID。'),
  appSecret: Schema.string().role('secret').required().description('机器人的应用密钥。'),
  ...omit(Quester.Config.dict, ['endpoint']),
})

export class FeishuBot extends Bot<BotConfig> {
  static schema = AdapterConfig
  _token?: string
  http: Quester

  constructor(adapter: Adapter, config: BotConfig) {
    super(adapter, config)

    this.selfId = config.appId

    this.http = adapter.ctx.http.extend({
      endpoint: config.endpoint,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  }

  get token() {
    return this._token
  }

  set token(v: string) {
    this._token = v
    this.http.config.headers.Authorization = `Bearer ${v}`
  }
}
