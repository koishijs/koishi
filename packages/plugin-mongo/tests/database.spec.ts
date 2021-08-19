import { App, Tests } from 'koishi-test-utils'
import * as mongo from 'koishi-plugin-mongo'

const getMongoPorts = () => {
  const argv = process.argv.splice(3)
  const match = /^--mongo-ports=(.*)/
  const ports = []
  for (let i = 0; i < argv.length; i++) {
    const envMatch = argv[i].match(match)
    envMatch && ports.push(...envMatch[1].split(',').map(port => +port))
  }
  return ports.length === 0 ? undefined : ports
}

const ports = getMongoPorts() ?? [27017]

describe('Mongo Plugin', () => {
  for (const port of ports) {
    describe(`Mongo Database (${port})`, () => {
      const app = new App()

      app.plugin(mongo, {
        host: 'localhost',
        port: port,
      })

      Tests.orm(app)
    })
  }
})
