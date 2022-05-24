import { Context, Schema } from 'koishi'
import MongoDriver from '@minatojs/driver-mongo'

export const name = 'MemoryDatabase'

export type Config = MongoDriver.Config

export const Config: Schema<Config> = Schema.object({
  protocol: Schema.string().description('要使用的协议名。').default('mongodb'),
  host: Schema.string().description('要连接到的主机名。').default('127.0.0.1'),
  port: Schema.natural().max(65535).description('要连接到的端口号。').default(27017),
  username: Schema.string().description('要使用的用户名。'),
  password: Schema.string().description('要使用的密码。').role('secret'),
  database: Schema.string().description('要访问的数据库名。').default('koishi'),
})

export function apply(ctx: Context, config: Config) {
  const driver = new MongoDriver(ctx.model, config)
  ctx.on('ready', () => driver.start())
  ctx.on('dispose', () => driver.stop())
}
