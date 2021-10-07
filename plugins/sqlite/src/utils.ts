import { Logger } from 'koishi'
import Factory from '@koishijs/sql-utils'
import { escape as sqlEscape, escapeId } from 'sqlstring-sqlite'

export const logger = new Logger('sqlite')

class SqliteUtils extends Factory {
  escape(value: any, stringifyObjects?: boolean, timeZone?: string) {
    if (value instanceof Date) {
      return (+value) + ''
    }
    return sqlEscape(value, stringifyObjects, timeZone)
  }

  escapeId = escapeId

  protected createElementQuery = (key: string, value: any) => {
    return `(',' || ${key} || ',') LIKE '%,${this.escape(value)},%'`
  }
}

export const utils = new SqliteUtils()
