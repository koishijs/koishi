import { App, Tests } from 'koishi-test-utils'
import * as mysql from 'koishi-plugin-mysql'
import parse from 'yargs-parser'

const { mysqlPorts } = parse(process.argv.slice(2), { string: ['mysql-ports'] })

for (const port of mysqlPorts ? mysqlPorts.split(',') : []) {
  describe(`MySQL Database (${port})`, () => {
    const app = new App()

    app.plugin(mysql, {
      host: 'localhost',
      port: port,
      user: 'koishi',
      password: 'koishi@114514',
      database: 'koishi',
    })

    Tests.database(app, {
      query: {
        list: {
          elementQuery: false,
        },
      },
    })
  })
}
