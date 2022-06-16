import { defineDriver, Schema } from 'koishi'
import MongoDriver from '@minatojs/driver-mongo'

export default defineDriver(MongoDriver, Schema.object({
  protocol: Schema.string().description('要使用的协议名。').default('mongodb'),
  host: Schema.string().description('要连接到的主机名。').default('localhost'),
  port: Schema.natural().max(65535).description('要连接到的端口号。'),
  username: Schema.string().description('要使用的用户名。'),
  password: Schema.string().description('要使用的密码。').role('secret'),
  database: Schema.string().description('要访问的数据库名。').default('koishi'),
}))
