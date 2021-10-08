import { escapeId, escape } from 'mysql'
import { SQLHelper } from '@koishijs/sql-utils'
import { Logger } from 'koishi'

class MysqlSQLHelper extends SQLHelper {
  escape = escape
  escapeId = escapeId
}

export const utils = new MysqlSQLHelper()

export const logger = new Logger('mysql')
