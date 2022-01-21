import { App } from 'koishi'
import { join } from 'path'
import tests from '@koishijs/database-tests'
import mock from '@koishijs/plugin-mock'
import sqlite from '@koishijs/plugin-database-sqlite'

describe(`SQLite Database`, () => {
  const app = new App()

  app.plugin(mock)

  app.plugin(sqlite, {
    path: join(__dirname, '..', 'tests', 'test.db'),
  })

  tests.database(app, {
    query: {
      list: {
        elementQuery: false,
      },
    },
  })
})
