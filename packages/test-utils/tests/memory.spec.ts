import { testDatabase } from '../src'
import {} from '../src/in-memory'

testDatabase({
  memory: {},
}, {
  beforeEachUser: app => app.database.memory.store.user = [],
  beforeEachGroup: app => app.database.memory.store.group = [],
})
