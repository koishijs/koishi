import { testDatabase } from 'koishi-test-utils'
import { injectMethods } from 'koishi-core'
import { resolve } from 'path'
import del from 'del'
import '../src'

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    foo: FooMethods
  }

  interface TableData {
    foo: FooData
  }
}

interface FooMethods {
  createFoo (data?: Partial<FooData>): Promise<FooData>
  removeFoo (id: number): Promise<void>
  getFooCount (): Promise<number>
}

interface FooData {
  id: number
  bar: string
}

const path = resolve(__dirname, '../temp')

afterAll(() => del(path))

injectMethods('level', 'foo', {
  async createFoo (data: Partial<FooData> = {}) {
    return await this.create('foo', data) as FooData
  },

  removeFoo (id: number) {
    return this.remove('foo', id)
  },

  getFooCount () {
    return this.count('foo')
  }
})

const app = testDatabase({
  level: { path },
}, {
  beforeEachUser: app => app.database.level.tables.user.clear(),
  beforeEachGroup: app => app.database.level.tables.group.clear(),
})

describe('other methods', () => {
  const { database: db } = app
  beforeAll(() => db.level.tables.foo.clear())

  test('create & remove', async () => {
    await expect(db.getFooCount()).resolves.toBe(0)
    await expect(db.createFoo()).resolves.toMatchObject({ id: 1 })
    await expect(db.getFooCount()).resolves.toBe(1)
    await expect(db.createFoo()).resolves.toMatchObject({ id: 2 })
    await expect(db.getFooCount()).resolves.toBe(2)
    await expect(db.removeFoo(1)).resolves.toBeUndefined()
    await expect(db.getFooCount()).resolves.toBe(1)
    await expect(db.createFoo()).resolves.toMatchObject({ id: 3 })
    await expect(db.getFooCount()).resolves.toBe(2)
    await expect(db.createFoo({ id: 100 })).resolves.toMatchObject({ id: 100 })
    await expect(db.getFooCount()).resolves.toBe(3)
    await expect(db.removeFoo(3)).resolves.toBeUndefined()
    await expect(db.getFooCount()).resolves.toBe(2)
    await expect(db.createFoo()).resolves.toMatchObject({ id: 3 })
    await expect(db.getFooCount()).resolves.toBe(3)
  })
})
