import { Logger } from 'koishi'
import { escape as sqlEscape } from 'sqlstring'
export { escapeId } from 'sqlstring'

export const logger = new Logger('sqlite3')

export function escape(value: any, stringifyObjects?: boolean, timeZone?: string) {
  if (value instanceof Date) {
    return (+value) + ''
  }
  return sqlEscape(value, stringifyObjects, timeZone)
}
