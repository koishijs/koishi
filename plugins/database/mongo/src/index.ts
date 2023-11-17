import { defineDriver, Schema } from 'koishi'
import { MongoDriver } from '@minatojs/driver-mongo'

export default defineDriver(MongoDriver, Schema.object({
  protocol: Schema.string().default('mongodb'),
  host: Schema.string().default('localhost'),
  port: Schema.natural().max(65535),
  username: Schema.string(),
  password: Schema.string().role('secret'),
  database: Schema.string().default('koishi'),
  writeConcern: Schema.object({
    w: Schema.union([
      Schema.const(undefined),
      Schema.number().required(),
      Schema.const('majority').required(),
    ]),
    wtimeoutMS: Schema.number(),
    journal: Schema.boolean(),
  }),
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
}))
