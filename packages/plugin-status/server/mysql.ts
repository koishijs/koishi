import { Database, Logger, Time } from 'koishi-core'
import { StatRecord, Synchronizer } from './database'
import { RECENT_LENGTH } from './stats'
import MysqlDatabase from 'koishi-plugin-mysql'

const logger = new Logger('status')

function joinKeys(keys: readonly string[]) {
  return keys.map(key => `\`${key}\``).join(',')
}

abstract class Stat<K extends string, V> {
  public data = {} as Record<K, V>
  private key: string = null

  constructor(private table: string, private fields: readonly K[]) {
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
    this.clear()
  }
}

namespace Stat {
  export class Recorded<K extends string> extends Stat<K, StatRecord> {
    constructor(table: string, fields: readonly K[]) {
      super(table, fields)

      Database.extend('koishi-plugin-mysql', ({ tables, Domain }) => {
        tables[table] = Object.assign([
          'primary key (`time`)',
        ], Object.fromEntries(fields.map(key => [key, new Domain.Json('text')])))
      })
    }

    setup() {
      return {}
    }

    create(value: StatRecord) {
      return `JSON_OBJECT(${Object.entries(value).map(([key, value]) => `'${key}', ${value}`).join(', ')})`
    }

    update(name: string, value: StatRecord) {
      const entries = Object.entries(value)
      if (!entries.length) return
      return `\`${name}\` = JSON_SET(\`${name}\`, ${entries.map(([key, value]) => {
        return `'$."${key}"', IFNULL(JSON_EXTRACT(\`${name}\`, '$."${key}"'), 0) + ${value}`
      }).join(', ')})`
    }

    add(field: K, key: string | number) {
      const stat: Record<string, number> = this.data[field]
      stat[key] = (stat[key] || 0) + 1
    }
  }

  export class Numerical<K extends string> extends Stat<K, number> {
    constructor(table: string, fields: readonly K[]) {
      super(table, fields)

      Database.extend('koishi-plugin-mysql', ({ tables }) => {
        tables[table] = Object.assign([
          'primary key (`time`)',
        ], Object.fromEntries(fields.map(key => [key, 'int unsigned'])))
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

Database.extend('koishi-plugin-mysql', {
  async getActiveData() {
    const [[{ 'COUNT(*)': activeUsers }], [{ 'COUNT(*)': activeGroups }]] = await this.query<[{ 'COUNT(*)': number }][]>([
      'SELECT COUNT(*) FROM `user` WHERE CURRENT_TIMESTAMP() - `lastCall` < 1000 * 3600 * 24',
      'SELECT COUNT(*) FROM `channel` WHERE `assignee`',
    ])
    return { activeGroups, activeUsers }
  },

  async setChannels(data) {
    await this.update('channel', data)
  },

  Synchronizer: class {
    private _daily = new Stat.Recorded('stats_daily', Synchronizer.dailyFields)
    private _hourly = new Stat.Numerical('stats_hourly', Synchronizer.hourlyFields)
    private _longterm = new Stat.Numerical('stats_longterm', Synchronizer.longtermFields)

    groups: StatRecord = {}
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
      const updateNumber = Time.getDateNumber(date)
      const sqls: string[] = []
      this._hourly.synchronize(hourString, sqls)
      this._daily.synchronize(dateString, sqls)
      this._longterm.synchronize(dateString, sqls)
      for (const id in this.groups) {
        sqls.push(`
          UPDATE \`channel\` SET
          \`activity\` = JSON_SET(\`activity\`, '$."${updateNumber}"', IFNULL(JSON_EXTRACT(\`activity\`, '$."${updateNumber}"'), 0) + ${this.groups[id]})
          WHERE \`id\` = '${id}'
        `)
        delete this.groups[id]
      }
      if (!sqls.length) return
      logger.debug('stats updated')
      await this.db.query(sqls)
    }

    async download(date: string) {
      const [daily, hourly, longterm, groups] = await this.db.query([
        'SELECT * FROM `stats_daily` WHERE `time` < DATE(?) ORDER BY `time` DESC LIMIT ?',
        'SELECT * FROM `stats_hourly` WHERE `time` < DATE(?) ORDER BY `time` DESC LIMIT ?',
        'SELECT * FROM `stats_longterm` WHERE `time` < DATE(?) ORDER BY `time` DESC',
        'SELECT `id`, `name`, `assignee` FROM `channel`',
      ], [date, RECENT_LENGTH, date, 24 * RECENT_LENGTH, date])
      return { daily, hourly, longterm, groups }
    }
  },
})

Database.extend('koishi-plugin-mysql', ({ tables, Domain }) => {
  tables.user.lastCall = 'timestamp'
  tables.channel.name = 'varchar(50)'
  tables.channel.activity = new Domain.Json()
})
