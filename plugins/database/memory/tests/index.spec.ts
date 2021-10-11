import { App, Tests } from '@koishijs/test-utils'
import * as database from '@koishijs/plugin-database-memory'
import { resolve } from 'path'

describe('Memory Database', () => {
  const app = new App()

  app.plugin(database, {
    storage: true,
    root: resolve(__dirname, 'temp'),
  })

  Tests.database(app)
})
