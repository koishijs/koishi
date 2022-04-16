import { Adapter, Bot, Quester, Schema } from 'koishi'
import { AdapterConfig } from './utils'

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
  token?: string
  endpoint?: string
}

export const BotConfig = Schema.intersect([
  Schema.object({
    token: Schema.string().role('secret'),
    endpoint: Schema.string().required(),
  }),
  Quester.Config,
])

export class FeishuBot extends Bot<BotConfig> {
  static schema = AdapterConfig
  token?: string
  http: Quester

  constructor(adapter: Adapter, config: BotConfig) {
    super(adapter, config)

    this.http = adapter.ctx.http.extend({
      endpoint: config.endpoint,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${this.token}`, // FIXME: token is dynamically updated by auth
      },
    })
  }
}
