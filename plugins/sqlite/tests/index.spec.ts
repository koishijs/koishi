import { App, Tests } from '@koishijs/test-utils'
import * as sqlite from '@koishijs/plugin-sqlite'
import { join } from 'path'
import { ensureDirSync } from 'fs-extra'

describe(`SQLite Database`, () => {
  const app = new App()

  ensureDirSync(join(__dirname, '..', 'test'))

  app.plugin(sqlite, {
    path: join(__dirname, '..', 'test', 'test.db'),
  })

  Tests.database(app, {
    query: {
      list: {
        elementQuery: false,
      },
    },
  })
})
