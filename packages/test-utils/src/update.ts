import { App, omit } from 'koishi'
import { expect } from 'chai'

interface Bar {
  id?: number
  text?: string
  num?: number
  list?: string[]
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
    temp2: Bar
    temp3: Baz
  }
}

function UpdateOperators(app: App) {
  app.model.extend('temp2', {
    id: 'unsigned',
    text: 'string',
    num: 'integer',
    list: 'list',
    date: 'timestamp',
    meta: 'json',
  }, {
    autoInc: true,
  })

  app.model.extend('temp3', {
    ida: 'unsigned',
    idb: 'string',
    value: 'string',
  }, {
    primary: ['ida', 'idb'],
  })
}

namespace UpdateOperators {
  export const insert = function Insert(app: App) {
    const magicBorn = new Date('1970/08/17')

    const merge = <T>(a: T, b: Partial<T>): T => ({ ...a, ...b })

    const barInsertions = [
      { id: 1 },
      { id: 2, text: 'pku' },
      { id: 3, num: 1989 },
      { id: 4, list: ['1', '1', '4'] },
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
      await app.database.remove('temp2', {})
      for (const i in barInsertions) {
        const bar = await app.database.create('temp2', omit(barInsertions[i], ['id']))
        barInsertions[i].id = bar.id
      }
      return barInsertions.map(bar => merge(app.model.create('temp2'), bar))
    }

    const setupBaz = async () => {
      await app.database.remove('temp3', {})
      for (const obj of bazInsertions) {
        await app.database.create('temp3', obj)
      }
      return bazInsertions.map(baz => merge(app.model.create('temp3'), baz))
    }

    before(async () => {
      await app.database.remove('temp2', {})
      await app.database.remove('temp3', {})
    })

    it('create with autoInc primary key', async () => {
      const barObjs = barInsertions.map(bar => merge(app.model.create('temp2'), bar))
      for (const i in barInsertions) {
        const bar = await app.database.create('temp2', omit(barInsertions[i], ['id']))
        barInsertions[i].id = bar.id
        expect(bar).shape(barObjs[i])
      }
      for (const obj of barObjs) {
        await expect(app.database.get('temp2', { id: obj.id })).eventually.shape([obj])
      }
      await expect(app.database.get('temp2', {})).eventually.shape(barObjs)
    })

    it('create with specified primary key', async () => {
      for (const obj of bazInsertions) {
        await expect(app.database.create('temp3', obj)).eventually.shape(obj)
      }
      for (const obj of bazInsertions) {
        await expect(app.database.get('temp3', { ida: obj.ida, idb: obj.idb })).eventually.shape([obj])
      }
    })

    it('create with duplicate primary key', async () => {
      await expect(app.database.create('temp2', { id: barInsertions[0].id })).eventually.rejected
      await expect(app.database.create('temp3', { ida: 1, idb: 'a' })).eventually.rejected
    })

    it('upsert new record', async () => {
      const barObjs = await setupBar()
      const updateBar = [{ id: barObjs[0].id, text: 'thu' }, { id: barObjs[1].id, num: 1911 }]
      updateBar.forEach(update => {
        const index = barObjs.findIndex(obj => obj.id === update.id)
        barObjs[index] = merge(barObjs[index], update)
      })
      await expect(app.database.upsert('temp2', updateBar)).eventually.fulfilled
      await expect(app.database.get('temp2', {})).eventually.shape(barObjs)
    })

    it('upsert duplicate records', async () => {
      const barObjs = await setupBar()
      const insertBar = [{ id: barObjs[5].id + 1, text: 'wmlake' }, { id: barObjs[5].id + 2, text: 'bytower' }]
      barObjs.push(...insertBar.map(bar => merge(app.model.create('temp2'), bar)))
      await expect(app.database.upsert('temp2', insertBar)).eventually.fulfilled
      await expect(app.database.get('temp2', {})).eventually.shape(barObjs)
    })

    it('set', async () => {
      const barObjs = await setupBar()
      const magicIds = [barObjs[0].id, barObjs[1].id]
      barObjs.filter(obj => magicIds.includes(obj.id) || obj.date === magicBorn).forEach(obj => {
        obj.num = 514
      })
      await expect(app.database.set('temp2', {
        $or: [
          { id: magicIds },
          { date: magicBorn },
        ],
      }, { num: 514 })).eventually.fulfilled
      await expect(app.database.get('temp2', {})).eventually.shape(barObjs)
    })

    it('remove', async () => {
      await setupBaz()
      await expect(app.database.remove('temp3', { ida: 1, idb: 'a' })).eventually.fulfilled
      await expect(app.database.get('temp3', {})).eventually.length(3)
      await expect(app.database.remove('temp3', { ida: 1, idb: 'b', value: 'b' })).eventually.fulfilled
      await expect(app.database.get('temp3', {})).eventually.length(3)
      await expect(app.database.remove('temp3', { idb: 'b' })).eventually.fulfilled
      await expect(app.database.get('temp3', {})).eventually.length(1)
      await expect(app.database.remove('temp3', {})).eventually.fulfilled
      await expect(app.database.get('temp3', {})).eventually.length(0)
      // Conditional
      const barObjs = await setupBar()
      await expect(app.database.remove('temp2', { id: { $gt: barObjs[1].id } })).eventually.fulfilled
      await expect(app.database.get('temp2', {})).eventually.length(2)
      await expect(app.database.remove('temp2', { id: { $lte: barObjs[1].id } })).eventually.fulfilled
      await expect(app.database.get('temp2', {})).eventually.length(0)
    })

    it('parallel create with incremental primary key', async () => {
      await app.database.remove('temp2', {})
      await Promise.all([...Array(5)].map(() => app.database.create('temp2', {})))
      const result = await app.database.get('temp2', {})
      expect(result).length(5)
      const ids = result.map(e => e.id).sort((a, b) => a - b)
      const min = Math.min(...ids)
      expect(ids.map(id => id - min + 1)).shape([1, 2, 3, 4, 5])
      await app.database.remove('temp2', {})
    })
  }
}

export default UpdateOperators
