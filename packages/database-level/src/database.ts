import { resolve } from 'path'
import { registerDatabase, TableType, TableData, AbstractDatabase } from 'koishi-core'
import { AbstractLevelDOWN } from 'abstract-leveldown'
import leveldown, { LevelDown } from 'leveldown'
import levelup, { LevelUp } from 'levelup'
import sub from 'subleveldown'

declare module 'koishi-core/dist/database' {
  interface Subdatabases {
    level: LevelDatabase
  }

  interface DatabaseConfig {
    level: LevelConfig
  }
}

interface LevelConfig {
  path: string
}

type Encodings = 'utf8' | 'json' | 'binary' | 'hex' | 'ascii' | 'base64' | 'ucs2' | 'utf16le' | 'utf-16le' | 'none'

interface CodecEncoder {
  encode: (val: any) => any
  decode: (val: any) => any
  buffer: boolean
  type: string
}

type EncodingOption = CodecEncoder | Encodings

interface SubConfig {
  name?: string
  valueEncoding: EncodingOption
  keyEncoding: EncodingOption
}

export const sublevels: Partial<Record<TableType, SubConfig>> = {}

const openedDBs = new Map<string, LevelUp<LevelDown>>()

type SubLevels = {
  [K in TableType]?: LevelUp<AbstractLevelDOWN<number, TableData[K]>>
}

export class LevelDatabase implements AbstractDatabase {
  private baseDB: LevelUp
  public subs: SubLevels = {}
  public identifier: string

  constructor ({ path }: LevelConfig) {
    this.identifier = path
    const absPath = resolve(process.cwd(), path)
    if (!openedDBs.has(absPath)) {
      openedDBs.set(absPath, levelup(leveldown(absPath)))
    }
    this.baseDB = openedDBs.get(absPath)

    for (const key in sublevels) {
      const config = sublevels[key]
      this.subs[key] = sub(this.baseDB, key, config)
    }
  }

  count (table: TableType) {
    return new Promise<number>(resolve => {
      let userNum = 0
      this.subs[table].createKeyStream()
        .on('data', () => userNum++)
        .on('end', () => resolve(userNum))
    })
  }
}

registerDatabase('level', LevelDatabase)
