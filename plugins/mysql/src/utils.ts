import { escapeId, escape } from 'mysql'
import Factory from '@koishijs/sql-utils'
import { Logger } from 'koishi'

class MysqlUtils extends Factory {
  escape = escape
  escapeId = escapeId
}

export const utils = new MysqlUtils()

export const logger = new Logger('mysql')
