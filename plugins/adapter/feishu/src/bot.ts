import { Adapter, Bot, Quester } from 'koishi'

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
  token?: string
}

export class FeishuBot extends Bot<BotConfig> {
  http: Quester

  constructor(adapter: Adapter, config: BotConfig) {
    super(adapter, config)
  }
}
