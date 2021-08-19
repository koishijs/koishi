import { App, Tests } from 'koishi-test-utils'
import * as mysql from 'koishi-plugin-mysql'

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

describe('Mysql Plugin', () => {
  for (const port of ports) {
    describe(`MySQL Database (${port})`, () => {
      const app = new App()

      app.plugin(mysql, {
        host: '47.113.125.249',
        port: 24501,
        user: 'demo_0',
        password: 'AxCG8GaikiE6f8rt',
        database: 'demo_0',
      })

      Tests.orm.BuiltinMethods(app)
    })
  }
})
