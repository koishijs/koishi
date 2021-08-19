import { App, User, Channel, Tables } from 'koishi-core'
import { expect } from 'chai'
import '../../chai'

interface Foo {
  id?: number
  bar?: string
  baz?: number
  list?: number[]
  date?: Date
}

declare module 'koishi-core' {
  interface Tables {
    foo: Foo
  }
}

Tables.extend('foo', {
  type: 'incremental',
  fields: {
    id: 'unsigned',
    bar: 'string',
    baz: 'integer',
    list: 'list',
    date: 'timestamp',
  },
})

export function ORMTests(app: App) {
  before(() => app.start())

  after(async () => {
    await app.database.drop()
    await app.stop()
  })
}

export namespace ORMTests {
  export const builtin = function BuiltinMethods(app: App) {
    const { database: db } = app

    it('user operations', async () => {
      await db.setUser('mock', 'A', User.create('mock', 'A'))
      await expect(db.getUser('mock', 'A')).eventually.not.to.be.ok

      await db.createUser('mock', 'A', { authority: 1 })
      await expect(db.getUser('mock', 'A')).eventually.to.have.shape({ authority: 1 })

      await db.setUser('mock', 'A', { authority: 2 })
      await expect(db.getUser('mock', 'A')).eventually.to.have.shape({ authority: 2 })

      await db.remove('user', { mock: ['A'] })
      await expect(db.getUser('mock', ['A'])).eventually.to.deep.equal([])
    })

    it('channel operations', async () => {
      await db.setChannel('mock', 'A', Channel.create('mock', 'A'))
      await expect(db.getChannel('mock', 'A')).eventually.not.to.be.ok

      await db.createChannel('mock', 'A', { assignee: '123' })
      await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({ assignee: '123' })

      await db.setChannel('mock', 'A', { assignee: '321' })
      await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({ assignee: '321' })

      await db.createChannel('mock', 'B', { assignee: app.bots[0].selfId })
      await db.createChannel('mock', 'C', { assignee: app.bots[0].selfId })
      await expect(db.getAssignedChannels(null)).eventually.to.have.length(2)
      await expect(db.getAssignedChannels(null, { mock: ['321'] })).eventually.to.have.length(1)

      await db.remove('channel', { id: ['mock:A'] })
      await expect(db.getChannel('mock', ['A'])).eventually.to.deep.equal([])
    })
  }

  export namespace query {
    export const name = 'QueryOperators'

    export const comparison = function Comparison(app: App) {
      const db = app.database

      before(async () => {
        await db.remove('foo', {})
        await db.create('foo', { bar: 'awesome foo', date: new Date('2000-01-01') })
        await db.create('foo', { bar: 'awesome bar' })
        await db.create('foo', { bar: 'awesome baz' })
      })

      it('compile expr query', async () => {
        await expect(db.get('foo', {
          id: { $eq: 2 },
        })).eventually.to.have.length(1).with.nested.property('0.bar').equal('awesome bar')

        await expect(db.get('foo', {
          id: { $ne: 3 },
        })).eventually.to.have.length(2).with.nested.property('0.bar').equal('awesome foo')

        await expect(db.get('foo', {
          id: { $gt: 1 },
        })).eventually.to.have.length(2).with.nested.property('1.bar').equal('awesome baz')

        await expect(db.get('foo', {
          id: { $gte: 3 },
        })).eventually.to.have.length(1).with.nested.property('0.bar').equal('awesome baz')

        await expect(db.get('foo', {
          id: { $lt: 1 },
        })).eventually.to.have.length(0)

        await expect(db.get('foo', {
          id: { $lte: 2 },
        })).eventually.to.have.length(2).with.nested.property('0.bar').equal('awesome foo')
      })

      it('date comparisons', async () => {
        await expect(db.get('foo', {
          date: { $gt: new Date('1999-01-01') },
        })).eventually.to.have.length(1).with.nested.property('0.bar').equal('awesome foo')

        await expect(db.get('foo', {
          date: { $lte: new Date('1999-01-01') },
        })).eventually.to.have.length(0)
      })

      it('shorthand syntax', async () => {
        await expect(db.get('foo', {
          id: 2,
        })).eventually.to.have.length(1).with.nested.property('0.bar').equal('awesome bar')

        await expect(db.get('foo', {
          date: new Date('2000-01-01'),
        })).eventually.to.have.length(1).with.nested.property('0.bar').equal('awesome foo')
      })
    }

    export const membership = function Membership(app: App) {
      const db = app.database

      before(async () => {
        await db.remove('foo', {})
        await db.create('foo', { baz: 3 })
        await db.create('foo', { baz: 4 })
        await db.create('foo', { baz: 7 })
      })

      it('should verify empty array', async () => {
        await expect(db.get('foo', {
          baz: { $in: [] },
        })).eventually.to.have.length(0)

        await expect(db.get('foo', {
          baz: { $nin: [] },
        })).eventually.to.have.length(3)
      })

      it('filter data by include', async () => {
        await expect(db.get('foo', {
          baz: { $in: [3, 4] },
        })).eventually.to.have.length(2)

        await expect(db.get('foo', {
          baz: { $nin: [4] },
        })).eventually.to.have.length(2)
      })
    }

    export const regexp = function RegularExpression(app: App) {
      const db = app.database

      before(async () => {
        await db.remove('foo', {})
        await db.create('foo', { bar: 'awesome foo' })
        await db.create('foo', { bar: 'awesome bar' })
        await db.create('foo', { bar: 'awesome foo bar' })
      })

      it('filter data by regex', async () => {
        await expect(db.get('foo', {
          bar: /^.*foo$/,
        })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')

        await expect(db.get('foo', {
          bar: { $regex: /^.*foo$/ },
        })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')

        await expect(db.get('foo', {
          bar: /^.*foo.*$/,
        })).eventually.to.have.length(2)
      })
    }

    export const bitwise = function Bitwise(app: App) {
      const db = app.database

      before(async () => {
        await db.remove('foo', {})
        await db.create('foo', { baz: 3 })
        await db.create('foo', { baz: 4 })
        await db.create('foo', { baz: 7 })
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
    }

    interface ListOptions {
      size?: boolean
      element?: boolean
      elementQuery?: boolean
    }

    export const list = function List(app: App, options: ListOptions = {}) {
      const db = app.database
      const { size = true, element = true, elementQuery = element } = options

      before(async () => {
        await db.remove('foo', {})
        await db.create('foo', { id: 1, list: [] })
        await db.create('foo', { id: 2, list: [23] })
        await db.create('foo', { id: 3, list: [233] })
        await db.create('foo', { id: 4, list: [233, 332] })
      })

      size && it('$size', async () => {
        await expect(db.get('foo', {
          list: { $size: 1 },
        })).eventually.to.have.length(2).with.shape([{ id: 2 }, { id: 3 }])
      })

      element && it('$el shorthand', async () => {
        await expect(db.get('foo', {
          list: { $el: 233 },
        })).eventually.to.have.length(2).with.shape([{ id: 3 }, { id: 4 }])
      })

      elementQuery && it('$el with field query', async () => {
        await expect(db.get('foo', {
          list: { $el: { $lt: 50 } },
        })).eventually.to.have.shape([{ id: 2 }])
      })
    }

    export const logical = function Logical(app: App) {
      const db = app.database

      before(async () => {
        await db.remove('foo', {})
        await db.create('foo', { id: 1, bar: 'awesome foo', baz: 3, list: [], date: new Date('2000-01-01') })
        await db.create('foo', { id: 2, bar: 'awesome bar', baz: 4, list: [1] })
        await db.create('foo', { id: 3, bar: 'awesome foo bar', baz: 7, list: [100] })
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
    }
  }
}
