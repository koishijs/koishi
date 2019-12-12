import { testDatabase } from 'koishi-test-utils'
import { resolve } from 'path'
import '../src'

// workaround levelup poor typings
declare module 'levelup' {
  interface LevelUp {
    clear (): Promise<void>
  }
}

testDatabase({
  level: { path: resolve(__dirname, '../temp') },
}, {
  beforeEachUser: app => app.database.level.subs.userDB.clear(),
  beforeEachGroup: app => app.database.level.subs.groupDB.clear(),
})
