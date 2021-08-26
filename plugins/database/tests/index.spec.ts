import { App, Tests } from '@koishijs/test-utils'
import * as database from '@koishijs/plugin-database'

describe('Memory Database', () => {
  const app = new App()

  app.plugin(database)

  Tests.database(app)
})
