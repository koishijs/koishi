import { App, Tests } from '@koishijs/test-utils'
import * as mysql from '@koishijs/plugin-mysql'

const getMysqlPorts = () => {
  const argv = process.argv.splice(3)
  const match = /^--mysql-ports=(.*)/
  const ports = []
  for (let i = 0; i < argv.length; i++) {
    const envMatch = argv[i].match(match)
    envMatch && ports.push(...envMatch[1].split(',').map(port => +port))
  }
  return ports.length === 0 ? undefined : ports
}

const ports = getMysqlPorts() ?? [3306]

for (const port of ports) {
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
