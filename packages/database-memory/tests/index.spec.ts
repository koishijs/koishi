import { testDatabase } from 'koishi-test-utils'
import '../src'

testDatabase({
  memory: {},
}, {
  beforeEachUser: app => app.database.memory.store.user = [],
  beforeEachGroup: app => app.database.memory.store.group = [],
})
