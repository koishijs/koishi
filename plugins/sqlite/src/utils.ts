import { Logger } from 'koishi'
import { QueryHelper, Caster } from '@koishijs/sql-utils'
import { escape as sqlEscape, escapeId } from 'sqlstring-sqlite'
export { TableCaster } from '@koishijs/sql-utils'

export const logger = new Logger('sqlite')

class SqliteQueryHelper extends QueryHelper {
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

export const queryHelper = new SqliteQueryHelper()

export const caster = new Caster()
caster.registerFieldCaster<object, string>({
  types: ['json'],
  dump: value => JSON.stringify(value),
  load: (value, initial) => value ? JSON.parse(value) : initial,
})
caster.registerFieldCaster<string[], string>({
  types: ['list'],
  dump: value => value.join(','),
  load: (value) => value ? value.split(',') : [],
})
caster.registerFieldCaster<Date, number>({
  types: ['date', 'time', 'timestamp'],
  dump: value => +value,
  load: (value) => value === null ? null : new Date(value),
})
