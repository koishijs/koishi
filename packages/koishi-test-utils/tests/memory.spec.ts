import { extendDatabase } from 'koishi-core'
import { MemoryDatabase, testDatabase, memory, MockedApp } from 'koishi-test-utils'
import { expect } from 'chai'

declare module 'koishi-core/dist/database' {
  interface Database {
    createFoo (data?: Partial<FooData>): Promise<FooData>
    removeFoo (id: number): Promise<void>
    getFooCount (): Promise<number>
  }

  interface Tables {
    foo: FooData
  }
}

interface FooData {
  id: number
  bar: string
}

extendDatabase(MemoryDatabase, {
  async createFoo(data: Partial<FooData> = {}) {
    return this.$create('foo', data) as FooData
  },

  async removeFoo(id: number) {
    return this.$remove('foo', id)
  },

  async getFooCount() {
    return this.$count('foo')
  },
})

const app = testDatabase(new MockedApp().plugin(memory), {
  beforeEachUser: app => app.database.$store.user = [],
  beforeEachGroup: app => app.database.$store.group = [],
})

describe('other methods', () => {
  const { database: db } = app
  before(() => db.$store.foo = [])

  it('create & remove', async () => {
    await expect(db.getFooCount()).eventually.to.equal(0)
    await expect(db.createFoo()).eventually.to.have.shape({ id: 1 })
    await expect(db.getFooCount()).eventually.to.equal(1)
    await expect(db.createFoo()).eventually.to.have.shape({ id: 2 })
    await expect(db.getFooCount()).eventually.to.equal(2)
    await expect(db.removeFoo(1)).eventually.to.be.undefined
    await expect(db.getFooCount()).eventually.to.equal(1)
    await expect(db.createFoo()).eventually.to.have.shape({ id: 1 })
    await expect(db.getFooCount()).eventually.to.equal(2)
    await expect(db.createFoo({ id: 100 })).eventually.to.have.shape({ id: 100 })
    await expect(db.getFooCount()).eventually.to.equal(3)
    await expect(db.removeFoo(1)).eventually.to.be.undefined
    await expect(db.getFooCount()).eventually.to.equal(2)
    await expect(db.createFoo()).eventually.to.have.shape({ id: 1 })
    await expect(db.getFooCount()).eventually.to.equal(3)
  })
})
