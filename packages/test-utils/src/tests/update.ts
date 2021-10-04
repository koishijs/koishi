import { App, omit, Tables } from 'koishi'
import { expect } from 'chai'
import '../../chai'

interface Bar {
  id?: number
  text?: string
  num?: number
  list?: number[]
  date?: Date
  meta?: any
}

interface Baz {
  ida?: number
  idb?: string
  value?: string
}

declare module 'koishi' {
  interface Tables {
    bar: Bar
    baz: Baz
  }
}

Tables.extend('bar', {
  id: 'unsigned',
  text: 'string',
  num: 'integer',
  list: 'list',
  date: 'timestamp',
  meta: 'json',
}, {
  autoInc: true,
})

Tables.extend('baz', {
  ida: 'unsigned',
  idb: 'string',
  value: 'string',
}, {
  primary: ['ida', 'idb'],
})

namespace UpdateOperators {
  export const name = 'UpdateOperators'

  export const insert = function Insert(app: App) {
    const magicBorn = new Date('1926/08/17')

    const merge = <T>(a: T, b: Partial<T>): T => ({ ...a, ...b })

    const barInsertions = [
      { id: 1 },
      { id: 2, text: 'pku' },
      { id: 3, num: 1989 },
      { id: 4, list: [1, 1, 4] },
      { id: 5, date: magicBorn },
      { id: 6, meta: { foo: 'bar' } },
    ]

    const bazInsertions = [
      { ida: 1, idb: 'a', value: 'a' },
      { ida: 2, idb: 'a', value: 'b' },
      { ida: 1, idb: 'b', value: 'c' },
      { ida: 2, idb: 'b', value: 'd' },
    ]

    const setupBar = async () => {
      await db.remove('bar', {})
      for (const i in barInsertions) {
        await db.create('bar', omit(barInsertions[i], ['id']))
      }
      return barInsertions.map(bar => merge(Tables.create('bar'), bar))
    }

    const setupBaz = async () => {
      await db.remove('baz', {})
      for (const obj of bazInsertions) {
        await db.create('baz', obj)
      }
      return bazInsertions.map(baz => merge(Tables.create('baz'), baz))
    }

    const { database: db } = app
    before(async () => {
      await db.remove('bar', {})
      await db.remove('baz', {})
    })

    it('create with autoInc primary key', async () => {
      const barObjs = barInsertions.map(bar => merge(Tables.create('bar'), bar))
      for (const i in barInsertions) {
        await expect(db.create('bar', omit(barInsertions[i], ['id']))).eventually.shape(barObjs[i])
      }
      for (const obj of barObjs) {
        await expect(db.get('bar', { id: obj.id })).eventually.shape([obj])
      }
      await expect(db.get('bar', {})).eventually.shape(barObjs)
    })

    it('create with specified primary key', async () => {
      for (const obj of bazInsertions) {
        await expect(db.create('baz', obj)).eventually.shape(obj)
      }
      for (const obj of bazInsertions) {
        await expect(db.get('baz', { ida: obj.ida, idb: obj.idb })).eventually.shape([obj])
      }
    })

    it('create with duplicate primary key', async () => {
      await expect(db.create('bar', { id: 1 })).eventually.not.to.be.ok
      await expect(db.create('baz', { ida: 1, idb: 'a' })).eventually.not.to.be.ok
    })

    it('upsert', async () => {
      const barObjs = await setupBar()
      const updateBar = [{ id: 1, text: 'thu' }, { id: 2, num: 1911 }]
      updateBar.forEach(update => {
        const index = barObjs.findIndex(obj => obj.id === update.id)
        barObjs[index] = merge(barObjs[index], update)
      })
      await expect(db.upsert('bar', updateBar)).eventually.fulfilled
      await expect(db.get('bar', {})).eventually.shape(barObjs)

      const insertBar = [{ id: 7, text: 'wmlake' }, { id: 8, text: 'bytower' }]
      barObjs.push(...insertBar.map(bar => merge(Tables.create('bar'), bar)))
      await expect(db.upsert('bar', insertBar)).eventually.fulfilled
      await expect(db.get('bar', {})).eventually.shape(barObjs)
    })

    it('set', async () => {
      const barObjs = await setupBar()
      const cond = {
        $or: [
          { id: { $in: [1, 2] } },
          { date: magicBorn },
        ],
      }
      barObjs.filter(obj => [1, 2].includes(obj.id) || obj.date === magicBorn).forEach(obj => {
        obj.num = 514
      })
      await expect(db.set('bar', cond, { num: 514 })).eventually.fulfilled
      await expect(db.get('bar', {})).eventually.shape(barObjs)
    })

    it('remove', async () => {
      await setupBar()
      await setupBaz()
      await expect(db.remove('baz', { ida: 1, idb: 'a' })).eventually.fulfilled
      await expect(db.get('baz', {})).eventually.length(3)
      await expect(db.remove('baz', { ida: 1, idb: 'b', value: 'b' })).eventually.fulfilled
      await expect(db.get('baz', {})).eventually.length(3)
      await expect(db.remove('baz', { idb: 'b' })).eventually.fulfilled
      await expect(db.get('baz', {})).eventually.length(1)
      await expect(db.remove('baz', {})).eventually.fulfilled
      await expect(db.get('baz', {})).eventually.length(0)
      // Conditional
      await expect(db.remove('bar', { id: { $gt: 2 } })).eventually.fulfilled
      await expect(db.get('bar', {})).eventually.length(2)
      await expect(db.remove('bar', { id: { $lte: 2 } })).eventually.fulfilled
      await expect(db.get('bar', {})).eventually.length(0)
    })
  }
}

export default UpdateOperators
