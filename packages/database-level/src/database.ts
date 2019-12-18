import { resolve } from 'path'
import { registerDatabase, TableType, TableData, InjectConfig } from 'koishi-core'
import { AbstractLevelDOWN } from 'abstract-leveldown'
import leveldown from 'leveldown'
import levelup, { LevelUp } from 'levelup'
import sub from 'subleveldown'

declare module 'koishi-core/dist/database' {
  interface Subdatabases {
    level: LevelDatabase
  }

  interface DatabaseConfig {
    level?: LevelConfig
  }

  interface InjectOptions {
    level: SubLevelConfig
  }
}

interface LevelConfig {
  path: string
}

interface CodecEncoder {
  encode: (val: any) => any
  decode: (val: any) => any
  buffer: boolean
  type: string
}

type EncodingOption = CodecEncoder | 'utf8' | 'json' | 'binary' | 'hex' | 'ascii' | 'base64' | 'ucs2' | 'utf16le' | 'utf-16le' | 'none'

interface SubLevelConfig {
  valueEncoding?: EncodingOption
  keyEncoding?: EncodingOption
}

const defaultSubLevelConfig: SubLevelConfig = {
  keyEncoding: 'json',
  valueEncoding: 'json',
}

type SubLevels = {
  [K in TableType]?: LevelUp<AbstractLevelDOWN<number, TableData[K]>>
}

export class LevelDatabase {
  private db: LevelUp
  public identifier: string
  public tables: SubLevels = {}

  static identify (config: LevelConfig) {
    return resolve(process.cwd(), config.path)
  }

  constructor (config: LevelConfig, tables: InjectConfig<'level'>) {
    this.db = levelup(leveldown(LevelDatabase.identify(config)))

    for (const key in tables) {
      const config = {
        ...defaultSubLevelConfig,
        ...tables[key as TableType],
      }
      this.tables[key] = sub(this.db, key, config)
    }
  }

  start () {
    return this.db.open()
  }

  stop () {
    return this.db.close()
  }

  async create <K extends TableType> (table: K, data: Partial<TableData[K]>) {
    const id = 1 + await new Promise<number>((resolve, reject) => {
      this.tables[table].createKeyStream({ reverse: true, limit: 1 })
        .on('data', key => resolve(key))
        .on('error', error => reject(error))
        .on('end', () => resolve(0))
    })
    if (!data.id) data.id = id
    await (this.tables[table] as any).put(id, data)
    return data as TableData[K]
  }

  async remove <K extends TableType> (table: K, id: number) {
    return this.tables[table].del(id)
  }

  count (table: TableType) {
    return new Promise<number>((resolve, reject) => {
      let userNum = 0
      this.tables[table].createKeyStream()
        .on('data', () => userNum++)
        .on('error', error => reject(error))
        .on('end', () => resolve(userNum))
    })
  }
}

registerDatabase('level', LevelDatabase)
