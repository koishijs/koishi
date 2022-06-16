import { defineDriver, Schema } from 'koishi'
import MySQLDriver from '@minatojs/driver-mysql'

export default defineDriver(MySQLDriver, Schema.object({
  host: Schema.string().description('要连接到的主机名。').default('localhost'),
  port: Schema.natural().max(65535).description('要连接到的端口号。').default(3306),
  user: Schema.string().description('要使用的用户名。').default('root'),
  password: Schema.string().description('要使用的密码。').role('secret'),
  database: Schema.string().description('要访问的数据库名。').default('koishi'),
}))
