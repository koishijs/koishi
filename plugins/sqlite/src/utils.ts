import { Logger } from 'koishi'
import { Caster } from '@koishijs/sql-utils'
export { TableCaster } from '@koishijs/sql-utils'

export const logger = new Logger('sqlite')

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
