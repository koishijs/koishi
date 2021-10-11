import { App, Tests } from '@koishijs/test-utils'
import * as sqlite from '@koishijs/plugin-database-sqlite'
import { join } from 'path'

describe(`SQLite Database`, () => {
  const app = new App()

  app.plugin(sqlite, {
    path: join(__dirname, '..', 'tests', 'test.db'),
  })

  Tests.database(app, {
    query: {
      list: {
        elementQuery: false,
      },
    },
  })
})
