import { expect } from 'chai'
import { Database, Tables } from 'koishi-core'
import { testDatabase, App } from 'koishi-test-utils'
import { Tests } from '../src'
import { ORMTests } from '../src/orm'

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
  baz?: number
  list?: number[]
  date?: Date
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
  const app = new App({ mockDatabase: true })
  Tests.orm(app)
  const db = app.database

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
      await db.createFoo({ bar: 'awesome foo', baz: 3, list: [], date: new Date('2000-01-01') })
      await db.createFoo({ bar: 'awesome bar', baz: 4, list: [1] })
      await db.createFoo({ bar: 'awesome foo bar', baz: 7, list: [100] })
    })

    after(() => {
      // clear memory data, prevent the following single test from being affected
      db.memory.$store.foo = []
    })

    it('should convert date to primitives when doing comparisons', async () => {
      await expect(db.get('foo', {
        date: { $eq: new Date('2000-01-01') },
      })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')

      await expect(db.get('foo', {
        date: { $gte: new Date('2000-01-01') },
      })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')
    })

    it('compile expr query', async () => {
      await expect(db.get('foo', {
        id: 1,
      })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')

      await expect(db.get('foo', {
        id: { $eq: 1 },
      })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')

      await expect(db.get('foo', {
        id: { $gt: 1 },
      })).eventually.to.have.nested.property('[0].bar').equal('awesome bar')

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
      })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')

      await expect(db.get('foo', {
        bar: {
          $regex: /^.*foo$/,
        },
      })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')

      await expect(db.get('foo', {
        bar: /^.*foo.*$/,
      })).eventually.to.have.length(2)
    })

    it('filter data by bits', async () => {
      await expect(db.get('foo', {
        baz: { $bitsAllSet: 3 },
      })).eventually.to.have.shape([{ baz: 3 }, { baz: 7 }])

      await expect(db.get('foo', {
        baz: { $bitsAllClear: 9 },
      })).eventually.to.have.shape([{ baz: 4 }])

      await expect(db.get('foo', {
        baz: { $bitsAnySet: 4 },
      })).eventually.to.have.shape([{ baz: 4 }, { baz: 7 }])

      await expect(db.get('foo', {
        baz: { $bitsAnyClear: 6 },
      })).eventually.to.have.shape([{ baz: 3 }, { baz: 4 }])
    })

    it('filter data by list operations', async () => {
      await expect(db.get('foo', {
        list: { $size: 1 },
      })).eventually.to.have.shape([{ baz: 4 }, { baz: 7 }])

      await expect(db.get('foo', {
        list: { $el: 100 },
      })).eventually.to.have.shape([{ baz: 7 }])

      await expect(db.get('foo', {
        list: { $el: { $lt: 50 } },
      })).eventually.to.have.shape([{ baz: 4 }])
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
