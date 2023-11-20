import { defineDriver, Schema } from 'koishi'
import { PostgresDriver } from '@minatojs/driver-postgres'

export default defineDriver(PostgresDriver, Schema.object({
  host: Schema.string().default('localhost'),
  port: Schema.natural().max(65535).default(5432),
  user: Schema.string().default('root'),
  password: Schema.string().role('secret'),
  database: Schema.string().default('koishi'),
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
}))
