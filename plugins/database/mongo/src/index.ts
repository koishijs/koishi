import { defineDriver, Schema } from 'koishi'
import { MongoDriver } from '@minatojs/driver-mongo'

export default defineDriver(MongoDriver, Schema.object({
  protocol: Schema.string().default('mongodb'),
  host: Schema.string().default('localhost'),
  port: Schema.natural().max(65535),
  username: Schema.string(),
  password: Schema.string().role('secret'),
  database: Schema.string().default('koishi'),
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
}))
