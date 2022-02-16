import { Context, Schema } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      sandbox: SandboxService
    }
  }
}

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export default class SandboxService extends DataService {
  static using = ['console'] as const
  static schema: Schema<Config> = Schema.object({})

  constructor(ctx: Context, private config: Config) {
    super(ctx, 'sandbox')

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })
  }
}
