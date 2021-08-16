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
  const ports = [27017]
  for (let i = 0; i < argv.length; i++) {
    const envMatch = argv[i].match(match)
    ports.push(+envMatch[1].split(','))
  }
  return ports
}

describe('Mongo Database', () => {
  it('should support mongo', async () => {
    const ports = getMongoPorts()
    for (const port of ports) {
      const app = new App()
      app.plugin(mongo, {
        host: 'localhost',
        port: port,
        username: 'koishi',
        password: 'koishi@114514',
      })
      await app.start()
      await app.stop()
    }
  })
})
