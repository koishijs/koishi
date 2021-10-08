import { escapeId, escape } from 'mysql'
import { QueryHelper } from '@koishijs/sql-utils'
import { Logger } from 'koishi'

class MysqlQueryHelper extends QueryHelper {
  escape = escape
  escapeId = escapeId
}

export const utils = new MysqlQueryHelper()

export const logger = new Logger('mysql')
