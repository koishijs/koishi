import { expect } from 'chai'
import { Database, Tables } from 'koishi-core'
import { testDatabase, App } from 'koishi-test-utils'

declare module 'koishi-core' {
  interface Database {
    createFoo(data?: FooData): Promise<FooData>
    removeFoo(id: number): Promise<void>
    getFooCount(): Promise<number>
  }

  interface Tables {
    foo: FooData
  }
}

interface FooData {
  id?: number
  bar: string
}

Tables.extend('foo')

Database.extend('koishi-test-utils', {
  async createFoo(data: FooData) {
    return this.create('foo', data)
  },

  async removeFoo(id: number) {
    return this.remove('foo', [id])
  },

  async getFooCount() {
    return this.$count('foo')
  },
})

describe('Memory Database', () => {
  const db = testDatabase(new App({ mockDatabase: true }))

  it('extended methods', async () => {
    db.memory.$store.foo = []
    await expect(db.getFooCount()).eventually.to.equal(0)
    await expect(db.createFoo({ bar: '0' })).eventually.to.have.shape({ id: 1 })
    await expect(db.getFooCount()).eventually.to.equal(1)
    await expect(db.createFoo({ bar: '1' })).eventually.to.have.shape({ id: 2 })
    await expect(db.getFooCount()).eventually.to.equal(2)
    await expect(db.removeFoo(1)).eventually.to.be.undefined
    await expect(db.getFooCount()).eventually.to.equal(1)
    await expect(db.createFoo({ bar: '2' })).eventually.to.have.shape({ id: 3 })
    await expect(db.getFooCount()).eventually.to.equal(2)
    await expect(db.removeFoo(1)).eventually.to.be.undefined
    await expect(db.getFooCount()).eventually.to.equal(2)
  })

  it('compile expr query', async () => {
    db.memory.$store.foo = []
    await expect(db.createFoo({ bar: 'awesome foo' }))
      .eventually.to.have.shape({ id: 1 })
    await expect(db.createFoo({ bar: 'awesome bar' }))
      .eventually.to.have.shape({ id: 2 })
    await expect(db.createFoo({ bar: 'awesome foo bar' }))
      .eventually.to.have.shape({ id: 3 })

    await expect(db.get('foo', {
      id: { $eq: 1 },
    })).eventually.to
      .have.nested.property('[0].bar')
      .equal('awesome foo')

    await expect(db.get('foo', {
      id: { $gt: 1 },
    })).eventually.to
      .have.nested.property('[0].bar')
      .equal('awesome bar')

    await expect(db.get('foo', {
      id: { $lt: 1 },
    })).eventually.length(0)
  })

  it('filter data by regex', async () => {
    db.memory.$store.foo = []
    await expect(db.createFoo({ bar: 'awesome foo' }))
      .eventually.to.have.shape({ id: 1 })
    await expect(db.createFoo({ bar: 'awesome bar' }))
      .eventually.to.have.shape({ id: 2 })
    await expect(db.createFoo({ bar: 'awesome foo bar' }))
      .eventually.to.have.shape({ id: 3 })

    await expect(db.get('foo', {
      bar: /^.*foo$/,
    })).eventually.to
      .have.nested.property('[0].bar')
      .equal('awesome foo')

    await expect(db.get('foo', {
      bar: {
        $regex: /^.*foo$/,
      },
    })).eventually.to
      .have.nested.property('[0].bar')
      .equal('awesome foo')

    await expect(db.get('foo', {
      bar: /^.*foo.*$/,
    })).eventually.length(2)
  })
})
