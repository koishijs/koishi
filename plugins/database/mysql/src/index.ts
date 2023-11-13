import { defineDriver, Schema } from 'koishi'
import { MySQLDriver } from '@minatojs/driver-mysql'

export default defineDriver(MySQLDriver, Schema.intersect([
  Schema.object({
    host: Schema.string().default('localhost'),
    port: Schema.natural().max(65535).default(3306),
    user: Schema.string().default('root'),
    password: Schema.string().role('secret'),
    database: Schema.string().default('koishi'),
  }),
  Schema.object({
    ssl: Schema.object({
      rejectUnauthorized: Schema.boolean().default(true),
    }),
  }),
]).i18n({
  'zh-CN': require('./locales/zh-CN'),
}))
