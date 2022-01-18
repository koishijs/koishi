import { App } from 'koishi'
import tests from '@koishijs/database-tests'
import mock from '@koishijs/plugin-mock'
import mysql from '@koishijs/plugin-database-mysql'
import parse from 'yargs-parser'

const { mysqlPorts = '3306' } = parse(process.argv.slice(2), { string: ['mysql-ports'] })

for (const port of mysqlPorts ? mysqlPorts.split(',') : []) {
  describe(`MySQL Database (${port})`, () => {
    const app = new App()

    app.plugin(mock)

    app.plugin(mysql, {
      host: 'localhost',
      port: +port,
      user: 'koishi',
      password: 'koishi@114514',
      database: 'test',
    })

    tests.database(app, {
      query: {
        list: {
          elementQuery: false,
        },
      },
    })
  })
}
