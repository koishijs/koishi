import { expect } from 'chai'
import { Database, Tables } from 'koishi'
import { testDatabase, App } from '@koishijs/test-utils'

declare module 'koishi' {
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

Database.extend('@koishijs/test-utils', {
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

  describe('base support', () => {
    after(() => {
      // clear memory data, prevent the following single test from being affected
      db.memory.$store.foo = []
    })

    it('extended methods', async () => {
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
  })

  describe('complex expression', () => {
    before(async () => {
      await db.createFoo({ bar: 'awesome foo' })
      await db.createFoo({ bar: 'awesome bar' })
      await db.createFoo({ bar: 'awesome foo bar' })
    })

    after(() => {
      // clear memory data, prevent the following single test from being affected
      db.memory.$store.foo = []
    })

    it('compile expr query', async () => {
      await expect(db.get('foo', {
        id: 1,
      })).eventually.to
        .have.nested.property('[0].bar')
        .equal('awesome foo')

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
      })).eventually.to.have.length(0)
    })

    it('should verify empty array', async () => {
      await expect(db.get('foo', {
        id: { $in: [] },
      })).eventually.to.have.length(0)

      await expect(db.get('foo', {
        id: { $nin: [] },
      })).eventually.to.have.length(3)
    })

    it('filter data by include', async () => {
      await expect(db.get('foo', {
        id: { $in: [1, 2] },
      })).eventually.to.have.length(2)

      await expect(db.get('foo', {
        id: { $nin: [1] },
      })).eventually.to.have.length(2)
    })

    it('filter data by regex', async () => {
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
      })).eventually.to.have.length(2)
    })

    it('should verify `$or`, `$and` and `$not`', async () => {
      await expect(db.get('foo', {
        $or: [{
          id: [1, 2],
        }, {
          id: [1, 3],
        }],
      })).eventually.to.have.length(3)

      await expect(db.get('foo', {
        $or: [{
          id: [2],
        }, {
          bar: /.*foo.*/,
        }],
      })).eventually.to.have.length(3)

      await expect(db.get('foo', {
        $or: [{
          id: { $gt: 1 },
        }, {
          bar: /.*foo$/,
        }],
      })).eventually.to.have.length(3)

      await expect(db.get('foo', {
        $or: [{ bar: /.*foo/ }, { bar: /foo.*/ }],
      })).eventually.to.have.length(2)

      await expect(db.get('foo', {
        $and: [{ bar: /.*foo$/ }, { bar: /foo.*/ }],
      })).eventually.to.have.length(1)

      await expect(db.get('foo', {
        $not: { $and: [{ bar: /.*foo$/ }, { bar: /foo.*/ }] },
      })).eventually.to.have.length(2)

      await expect(db.get('foo', {
        $not: { $or: [{ bar: /.*foo/ }, { bar: /foo.*/ }] },
      })).eventually.to.have.length(1)
    })

    it('should verify `$or` and other key', async () => {
      await expect(db.get('foo', {
        bar: /.*foo.*/,
        $or: [{
          bar: /.*foo/,
        }],
      })).eventually.to.have.length(2)

      await expect(db.get('foo', {
        bar: /.*foo.*/,
        $or: [{
          bar: /foo.+/,
        }],
      })).eventually.to.have.length(1)
    })
  })
})
