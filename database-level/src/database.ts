import { resolve } from 'path'
import { registerDatabase } from 'koishi-core'
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

interface SubConfig { name?: string, valueEncoding: EncodingOption, keyEncoding: EncodingOption }

export const sublevels: Record<string, SubConfig> = {}

const openedDBs = new Map<string, LevelUp<LevelDown>>()

export class LevelDatabase {
  private baseDB: LevelUp
  public subs: Record<string, LevelUp> = {}

  constructor({ path }: LevelConfig) {
    const absPath = resolve(process.cwd(), path)
    if (!openedDBs.has(absPath)) {
      openedDBs.set(absPath, levelup(leveldown(absPath)))
    }
    this.baseDB = openedDBs.get(absPath)

    Object.entries(sublevels).forEach(([name, config]) => this.subs[name] = this.separate({ name, ...config }))
  }

  separate ({ name, valueEncoding, keyEncoding }: SubConfig): LevelUp {
    return sub(this.baseDB, name, { valueEncoding, keyEncoding })
  }

  count (subDatabaseName: 'groupDB' | 'userDB') {
    return new Promise<number>(resolve => {
      let userNum = 0
      this.subs[subDatabaseName].createKeyStream()
        .on('data', () => userNum++)
        .on('end', () => resolve(userNum))
    })
  }
}

registerDatabase('level', LevelDatabase)
