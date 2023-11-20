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
    ssl: Schema.union([
      Schema.const(null),
      Schema.object({
        ca: Schema.string(),
        cert: Schema.string(),
        sigalgs: Schema.string(),
        ciphers: Schema.string(),
        clientCertEngine: Schema.string(),
        crl: Schema.string(),
        dhparam: Schema.string(),
        ecdhCurve: Schema.string(),
        honorCipherOrder: Schema.boolean(),
        key: Schema.string(),
        privateKeyEngine: Schema.string(),
        privateKeyIdentifier: Schema.string(),
        maxVersion: Schema.string(),
        minVersion: Schema.string(),
        passphrase: Schema.string(),
        pfx: Schema.string(),
        rejectUnauthorized: Schema.boolean(),
        secureOptions: Schema.natural(),
        secureProtocol: Schema.string(),
        sessionIdContext: Schema.string(),
        sessionTimeout: Schema.number(),
      }),
    ]) as any,
  }),
]).i18n({
  'zh-CN': require('./locales/zh-CN'),
}))
