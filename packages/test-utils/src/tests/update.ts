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

    const barObjs = [
      { id: 1 },
      { id: 2, text: 'pku' },
      { id: 3, num: 1989 },
      { id: 4, list: [1, 1, 4] },
      { id: 5, date: magicBorn },
      { id: 6, meta: { foo: 'bar' } },
    ]

    const { database: db } = app
    before(async () => {
      await db.remove('bar', {})
      await db.remove('baz', {})
    })

    it('create with autoInc primary key', async () => {
      for (const obj of barObjs) {
        await expect(db.create('bar', omit(obj, ['id']))).eventually.shape(obj)
      }
      for (const obj of barObjs) {
        await expect(db.get('bar', { id: obj.id })).eventually.shape([obj])
      }
      await expect(db.get('bar', {})).eventually.shape(barObjs)
    })

    it('create with specified primary key', async () => {
      const objs = [
        { ida: 1, idb: 'a', value: 'a' },
        { ida: 2, idb: 'a', value: 'b' },
        { ida: 1, idb: 'b', value: 'c' },
        { ida: 2, idb: 'b', value: 'd' },
      ]
      for (const obj of objs) {
        await expect(db.create('baz', obj)).eventually.shape(obj)
      }
      for (const obj of objs) {
        await expect(db.get('baz', { ida: obj.ida, idb: obj.idb })).eventually.shape([obj])
      }
    })

    it('create with duplicate primary key', async () => {
      await expect(db.create('bar', { id: 1 })).eventually.not.to.be.ok
      await expect(db.create('baz', { ida: 1, idb: 'a' })).eventually.not.to.be.ok
    })

    it('upsert update', async () => {
      const updateBar = [{ id: 1, text: 'thu' }, { id: 2, num: 1911 }]
      updateBar.forEach(update => {
        const index = barObjs.findIndex(obj => obj.id === update.id)
        barObjs[index] = merge(barObjs[index], update)
      })
      await expect(db.upsert('bar', updateBar)).eventually.fulfilled
      await expect(db.get('bar', {})).eventually.shape(barObjs)
    })

    it('upsert insert', async () => {
      const insertBar = [{ id: 7, text: 'wmlake' }, { id: 8, text: 'bytower' }]
      barObjs.push(...insertBar)
      await expect(db.upsert('bar', insertBar)).eventually.fulfilled
      await expect(db.get('bar', {})).eventually.shape(barObjs)
    })

    it('set', async () => {
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
