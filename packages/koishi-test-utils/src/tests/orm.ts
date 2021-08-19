import { App, User, Channel, Tables } from 'koishi-core'
import { expect } from 'chai'
import '../../chai'

interface Foo {
  id?: number
  bar: string
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
})

export namespace ORMTests {
  export function BuiltinMethods(app: App) {
    const { database: db } = app

    before(() => app.start())
    after(() => app.stop())

    it('user operations', async () => {
      await db.setUser('mock', 'A', User.create('mock', 'A'))
      await expect(db.getUser('mock', 'A')).eventually.not.to.be.ok

      await db.createUser('mock', 'A', { authority: 1 })
      await expect(db.getUser('mock', 'A')).eventually.to.have.shape({
        authority: 1,
      })

      await db.setUser('mock', 'A', { authority: 2 })
      await expect(db.getUser('mock', 'A')).eventually.to.have.shape({
        authority: 2,
      })

      await db.remove('user', { mock: ['A'] })
      await expect(db.getUser('mock', ['A'])).eventually.to.deep.equal([])
    })

    it('channel operations', async () => {
      await db.setChannel('mock', 'A', Channel.create('mock', 'A'))
      await expect(db.getChannel('mock', 'A')).eventually.not.to.be.ok

      await db.createChannel('mock', 'A', { assignee: '123' })
      await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({
        assignee: '123',
      })

      await db.setChannel('mock', 'A', { assignee: '321' })
      await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({
        assignee: '321',
      })

      await db.createChannel('mock', 'B', {})
      await db.createChannel('mock', 'C', {})
      await expect(db.getAssignedChannels(null)).eventually.to.have.length(2)
      await expect(db.getAssignedChannels(null, { mock: ['321'] })).eventually.to.have.length(1)

      await db.remove('channel', { id: ['mock:A'] })
      await expect(db.getChannel('mock', ['A'])).eventually.to.deep.equal([])
    })
  }

  export function QueryOperators(app: App) {
    const db = app.database

    before(async () => {
      await db.create('foo', { bar: 'awesome foo', baz: 3, list: [], date: new Date('2000-01-01') })
      await db.create('foo', { bar: 'awesome bar', baz: 4, list: [1] })
      await db.create('foo', { bar: 'awesome foo bar', baz: 7, list: [100] })
    })
  }

  export namespace QueryOperators {
    export function Comparison(app: App) {
      const db = app.database

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

      it('should convert date to primitives when doing comparisons', async () => {
        await expect(db.get('foo', {
          date: { $eq: new Date('2000-01-01') },
        })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')

        await expect(db.get('foo', {
          date: { $gte: new Date('2000-01-01') },
        })).eventually.to.have.nested.property('[0].bar').equal('awesome foo')
      })
    }

    export function Membership(app: App) {
      const db = app.database

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
    }

    export function RegularExpression(app: App) {
      const db = app.database

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
    }

    export function Bitwise(app: App) {
      const db = app.database

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

    export function List(app: App) {
      const db = app.database

      it('filter data by list operators', async () => {
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
    }

    export function Logical(app: App) {
      const db = app.database

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
