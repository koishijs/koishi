import { Logger } from 'koishi'
import Factory, { escape as sqlEscape } from '@koishijs/sql-utils'

export const logger = new Logger('sqlite')

logger.level = 4

const { escape, escapeId, parseEval, parseQuery } = new class extends Factory {
  escape = (value: any, stringifyObjects?: boolean, timeZone?: string) => {
    if (value instanceof Date) {
      return (+value) + ''
    }
    return sqlEscape(value, stringifyObjects, timeZone)
  }

  createElementQuery = (key: string, value: any) => {
    return `(',' || ${key} || ',') LIKE '%,${this.escape(value)},%'`
  }
}()

export { escape, escapeId, parseEval, parseQuery }
