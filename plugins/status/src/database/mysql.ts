import { Database, Logger, Tables, Time, Dict } from 'koishi'
import { Synchronizer, RECENT_LENGTH } from '../stats'
import type MysqlDatabase from '@koishijs/plugin-database-mysql'

const logger = new Logger('status')

function joinKeys(keys: readonly string[]) {
  return keys.map(key => `\`${key}\``).join(',')
}

abstract class Stat<K extends string, V> {
  public data = {} as Record<K, V>
  private key: string = null

  constructor(private table: string, private fields: readonly K[], private preserve: boolean) {
    this.clear()
  }

  protected abstract setup(): V
  protected abstract create(value: V): string
  protected abstract update(key: string, value: V): string

  private clear() {
    for (const key of this.fields) {
      this.data[key] = this.setup()
    }
  }

  synchronize(date: string, sqls: string[]) {
    const updates: string[] = []
    for (const name in this.data) {
      if (!this.fields.includes(name)) {
        logger.warn(new Error(`unknown key "${name}" in stats table "${this.table}"`))
        delete this.data[name]
        continue
      }
      const update = this.update(name, this.data[name])
      if (update) updates.push(update)
    }
    if (!updates.length) return

    logger.debug(this.table, this.data)
    if (date === this.key) {
      sqls.push(`UPDATE \`${this.table}\` SET ${updates.join(', ')} WHERE \`time\` = "${date}"`)
    } else {
      this.key = date
      sqls.push(`\
INSERT INTO \`${this.table}\` (\`time\`, ${joinKeys(Object.keys(this.data))}) \
VALUES ("${date}", ${Object.values(this.data).map(this.create).join(', ')}) \
ON DUPLICATE KEY UPDATE ${updates.join(', ')}`)
    }
    if (!this.preserve) sqls.push(`DELETE FROM \`${this.table}\` WHERE datediff("${date}", \`time\`) > 10`)
    this.clear()
  }
}

namespace Stat {
  export class Recorded<K extends string> extends Stat<K, Dict<number>> {
    constructor(table: string, fields: readonly K[], preserve: boolean) {
      super(table, fields, preserve)
      Tables.extend(table as any, {}, { primary: 'time' })
      Database.extend('database-mysql', ({ tables, Domain }) => {
        tables[table] = Object.fromEntries(fields.map(key => [key, new Domain.Json()]))
        tables[table].time = 'datetime'
      })
    }

    setup() {
      return {}
    }

    create(value: Dict<number>) {
      return `JSON_OBJECT(${Object.entries(value).map(([key, value]) => `'${key}', ${value}`).join(', ')})`
    }

    update(name: string, value: Dict<number>) {
      const entries = Object.entries(value)
      if (!entries.length) return
      return `\`${name}\` = JSON_SET(\`${name}\`, ${entries.map(([key, value]) => {
        return `'$."${key}"', IFNULL(JSON_EXTRACT(\`${name}\`, '$."${key}"'), 0) + ${value}`
      }).join(', ')})`
    }
  }

  export class Numerical<K extends string> extends Stat<K, number> {
    constructor(table: string, fields: readonly K[], preserve: boolean) {
      super(table, fields, preserve)
      Tables.extend(table as any, {}, { primary: 'time' })
      Database.extend('database-mysql', ({ tables }) => {
        tables[table] = Object.fromEntries(fields.map(key => [key, 'int unsigned']))
        tables[table].time = 'datetime'
      })
    }

    setup() {
      return 0
    }

    create(value: number) {
      return '' + value
    }

    update(key: string, value: number) {
      if (!value) return
      return `\`${key}\` = \`${key}\` + ${value}`
    }
  }
}

class MysqlSynchronizer implements Synchronizer {
  private _daily = new Stat.Recorded('stats_daily', Synchronizer.dailyFields, false)
  private _hourly = new Stat.Numerical('stats_hourly', Synchronizer.hourlyFields, false)
  private _longterm = new Stat.Numerical('stats_longterm', Synchronizer.longtermFields, true)

  groups: Dict<number> = {}
  daily = this._daily.data
  hourly = this._hourly.data
  longterm = this._longterm.data

  constructor(private db: MysqlDatabase) {}

  addDaily(field: Synchronizer.DailyField, key: string | number) {
    const stat: Record<string, number> = this._daily.data[field]
    stat[key] = (stat[key] || 0) + 1
  }

  async upload(date: Date): Promise<void> {
    const dateString = date.toLocaleDateString('zh-CN')
    const hourString = `${dateString}-${date.getHours()}:00`
    const sqls: string[] = []
    this._hourly.synchronize(hourString, sqls)
    this._daily.synchronize(dateString, sqls)
    this._longterm.synchronize(dateString, sqls)
    for (const id in this.groups) {
      const update = Stat.Recorded.prototype.update('activity', { [Time.getDateNumber(date)]: this.groups[id] })
      sqls.push(`UPDATE \`channel\` SET ${update} WHERE \`id\` = '${id}'`)
      delete this.groups[id]
    }
    if (!sqls.length) return
    logger.debug('stats updated')
    await this.db.query(sqls)
  }

  async download() {
    const [daily, hourly, longterm, groups] = await this.db.query([
      'SELECT * FROM `stats_daily` WHERE `time` < CURRENT_TIMESTAMP ORDER BY `time` DESC LIMIT ?',
      'SELECT * FROM `stats_hourly` WHERE `time` < CURRENT_TIMESTAMP ORDER BY `time` DESC LIMIT ?',
      'SELECT * FROM `stats_longterm` WHERE `time` < CURRENT_TIMESTAMP ORDER BY `time` DESC',
      'SELECT `id`, `name`, `assignee` FROM `channel`',
    ], [RECENT_LENGTH, 24 * RECENT_LENGTH])
    return { daily, hourly, longterm, groups }
  }
}

Database.extend('database-mysql', {
  async stats() {
    const [[{ activeUsers }], [{ allUsers }], [{ activeGroups }], [{ allGroups }], tablesStats] = await this.query([
      'SELECT COUNT(*) as activeUsers FROM `user` WHERE CURRENT_TIMESTAMP() - `lastCall` < 1000 * 3600 * 24',
      'SELECT COUNT(*) as allUsers FROM `user`',
      'SELECT COUNT(*) as activeGroups FROM `channel` WHERE `assignee`',
      'SELECT COUNT(*) as allGroups FROM `channel`',
      'SELECT TABLE_NAME as name, TABLE_ROWS as count, DATA_LENGTH as size from information_schema.TABLES where TABLE_SCHEMA = ' + this.sql.escape(this.config.database),
    ])
    const tables = Object.fromEntries(tablesStats.map(({ name, ...data }) => [name, data]))
    return { activeUsers, allUsers, activeGroups, allGroups, tables }
  },

  createSynchronizer() {
    return new MysqlSynchronizer(this)
  },
})
