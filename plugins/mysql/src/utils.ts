import { escapeId, escape } from 'mysql'
import { SQLBuilder } from '@koishijs/sql-utils'
import { Logger } from 'koishi'

export const utils = new class extends SQLBuilder {
  escape = escape
  escapeId = escapeId
}()

export const logger = new Logger('mysql')
