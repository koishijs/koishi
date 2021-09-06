import { App, Tables } from 'koishi-core'
import { expect } from 'chai'
import '../../chai'

interface Foo {
  id?: number
  text?: string
  value?: number
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
    text: 'string',
    value: 'integer',
    list: 'list',
    date: 'timestamp',
  },
})

namespace QueryOperators {
  export const name = 'QueryOperators'

  export const comparison = function Comparison(app: App) {
    const db = app.database

    before(async () => {
      await db.remove('foo', {})
      await db.create('foo', { text: 'awesome foo', date: new Date('2000-01-01') })
      await db.create('foo', { text: 'awesome bar' })
      await db.create('foo', { text: 'awesome baz' })
    })

    it('compile expr query', async () => {
      await expect(db.get('foo', {
        id: { $eq: 2 },
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome bar')

      await expect(db.get('foo', {
        id: { $ne: 3 },
      })).eventually.to.have.length(2).with.nested.property('0.text').equal('awesome foo')

      await expect(db.get('foo', {
        id: { $gt: 1 },
      })).eventually.to.have.length(2).with.nested.property('1.text').equal('awesome baz')

      await expect(db.get('foo', {
        id: { $gte: 3 },
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome baz')

      await expect(db.get('foo', {
        id: { $lt: 1 },
      })).eventually.to.have.length(0)

      await expect(db.get('foo', {
        id: { $lte: 2 },
      })).eventually.to.have.length(2).with.nested.property('0.text').equal('awesome foo')
    })

    it('date comparisons', async () => {
      await expect(db.get('foo', {
        date: { $gt: new Date('1999-01-01') },
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome foo')

      await expect(db.get('foo', {
        date: { $lte: new Date('1999-01-01') },
      })).eventually.to.have.length(0)
    })

    it('shorthand syntax', async () => {
      await expect(db.get('foo', {
        id: 2,
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome bar')

      await expect(db.get('foo', {
        date: new Date('2000-01-01'),
      })).eventually.to.have.length(1).with.nested.property('0.text').equal('awesome foo')
    })
  }

  export const membership = function Membership(app: App) {
    const db = app.database

    before(async () => {
      await db.remove('foo', {})
      await db.create('foo', { value: 3 })
      await db.create('foo', { value: 4 })
      await db.create('foo', { value: 7 })
    })

    it('should verify empty array', async () => {
      await expect(db.get('foo', {
        value: { $in: [] },
      })).eventually.to.have.length(0)

      await expect(db.get('foo', {
        value: { $nin: [] },
      })).eventually.to.have.length(3)
    })

    it('filter data by include', async () => {
      await expect(db.get('foo', {
        value: { $in: [3, 4] },
      })).eventually.to.have.length(2)

      await expect(db.get('foo', {
        value: { $nin: [4] },
      })).eventually.to.have.length(2)
    })
  }

  export const regexp = function RegularExpression(app: App) {
    const db = app.database

    before(async () => {
      await db.remove('foo', {})
      await db.create('foo', { text: 'awesome foo' })
      await db.create('foo', { text: 'awesome bar' })
      await db.create('foo', { text: 'awesome foo bar' })
    })

    it('filter data by regex', async () => {
      await expect(db.get('foo', {
        text: /^.*foo$/,
      })).eventually.to.have.nested.property('[0].text').equal('awesome foo')

      await expect(db.get('foo', {
        text: { $regex: /^.*foo$/ },
      })).eventually.to.have.nested.property('[0].text').equal('awesome foo')

      await expect(db.get('foo', {
        text: /^.*foo.*$/,
      })).eventually.to.have.length(2)
    })
  }

  export const bitwise = function Bitwise(app: App) {
    const db = app.database

    before(async () => {
      await db.remove('foo', {})
      await db.create('foo', { value: 3 })
      await db.create('foo', { value: 4 })
      await db.create('foo', { value: 7 })
    })

    it('filter data by bits', async () => {
      await expect(db.get('foo', {
        value: { $bitsAllSet: 3 },
      })).eventually.to.have.shape([{ value: 3 }, { value: 7 }])

      await expect(db.get('foo', {
        value: { $bitsAllClear: 9 },
      })).eventually.to.have.shape([{ value: 4 }])

      await expect(db.get('foo', {
        value: { $bitsAnySet: 4 },
      })).eventually.to.have.shape([{ value: 4 }, { value: 7 }])

      await expect(db.get('foo', {
        value: { $bitsAnyClear: 6 },
      })).eventually.to.have.shape([{ value: 3 }, { value: 4 }])
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

  export const evaluation = function Evaluation(app: App) {
    const db = app.database

    before(async () => {
      await db.remove('foo', {})
      await db.create('foo', { id: 1, value: 8 })
      await db.create('foo', { id: 2, value: 7 })
      await db.create('foo', { id: 3, value: 9 })
    })

    it('arithmetic operators', async () => {
      await expect(db.get('foo', {
        $expr: { $eq: [9, { $add: ['id', 'value'] }] },
      })).eventually.to.have.length(2).with.shape([{ id: 1 }, { id: 2 }])
    })
  }

  export const logical = function Logical(app: App) {
    const db = app.database

    before(async () => {
      await db.remove('foo', {})
      await db.create('foo', { id: 1, text: 'awesome foo', value: 3, list: [], date: new Date('2000-01-01') })
      await db.create('foo', { id: 2, text: 'awesome bar', value: 4, list: [1] })
      await db.create('foo', { id: 3, text: 'awesome foo bar', value: 7, list: [100] })
    })

    it('edge cases', async () => {
      await expect(db.get('foo', {})).eventually.to.have.length(3)
      await expect(db.get('foo', { $and: [] })).eventually.to.have.length(3)
      await expect(db.get('foo', { $or: [] })).eventually.to.have.length(0)
      await expect(db.get('foo', { $not: {} })).eventually.to.have.length(0)
      await expect(db.get('foo', { $not: { $and: [] } })).eventually.to.have.length(0)
      await expect(db.get('foo', { $not: { $or: [] } })).eventually.to.have.length(3)
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
          text: /.*foo.*/,
        }],
      })).eventually.to.have.length(3)

      await expect(db.get('foo', {
        $or: [{
          id: { $gt: 1 },
        }, {
          text: /.*foo$/,
        }],
      })).eventually.to.have.length(3)

      await expect(db.get('foo', {
        $or: [{ text: /.*foo/ }, { text: /foo.*/ }],
      })).eventually.to.have.length(2)

      await expect(db.get('foo', {
        $and: [{ text: /.*foo$/ }, { text: /foo.*/ }],
      })).eventually.to.have.length(1)

      await expect(db.get('foo', {
        $not: { $and: [{ text: /.*foo$/ }, { text: /foo.*/ }] },
      })).eventually.to.have.length(2)

      await expect(db.get('foo', {
        $not: { $or: [{ text: /.*foo/ }, { text: /foo.*/ }] },
      })).eventually.to.have.length(1)
    })

    it('should verify `$or` and other key', async () => {
      await expect(db.get('foo', {
        text: /.*foo.*/,
        $or: [{
          text: /.*foo/,
        }],
      })).eventually.to.have.length(2)

      await expect(db.get('foo', {
        text: /.*foo.*/,
        $or: [{
          text: /foo.+/,
        }],
      })).eventually.to.have.length(1)
    })
  }
}

export default QueryOperators
