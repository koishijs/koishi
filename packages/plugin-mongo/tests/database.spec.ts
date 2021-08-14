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

describe('Mongo Database', () => {
  it('should support mongo', async () => {
    const app = new App()
    app.plugin(mongo, {
      host: 'localhost',
      port: 27017,
      username: 'koishi',
      password: 'koishi@114514',
    })
    await app.start()
  })
})
