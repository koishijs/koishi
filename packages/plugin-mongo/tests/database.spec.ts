import { Tables } from 'koishi-core'
import { App } from 'koishi-test-utils'
import * as mongo from 'koishi-plugin-mongo'

declare module 'koishi-core' {
  interface Tables {
    foo: FooData
  }
}

interface FooData {
  id?: number
  bar: string
}

Tables.extend('foo')

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

describe('Mongo Database', () => {
  it('should support mongo', async () => {
    const ports = getMongoPorts() ?? [27017]
    for (const port of ports) {
      const app = new App()
      app.plugin(mongo, {
        host: 'localhost',
        port: port
      })
      await app.start()
      await app.stop()
    }
  })
})
