import { App, Tests } from '@koishijs/test-utils'
import * as sqlite from '@koishijs/plugin-sqlite'

describe(`SQLite Database`, () => {
  const app = new App()

  app.plugin(sqlite, { })

  Tests.database(app, {
    query: {
      list: {
        elementQuery: false,
      },
    },
  })
})
