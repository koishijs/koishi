import { testDatabase } from 'koishi-test-utils'
import '../src'

testDatabase({
  sqlite: { path: ':memory:' },
}, {
  beforeEachUser: app => app.database.sqlite.get('DELETE FROM "user"'),
  beforeEachGroup: app => app.database.sqlite.get('DELETE FROM "group"'),
})

// TODO: add test for disk files
