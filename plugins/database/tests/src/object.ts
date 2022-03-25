import { App } from 'koishi'
import { expect } from 'chai'

interface ObjectModel {
  id: string
  meta?: {
    a?: string
    embed?: {
      b?: number
    }
  }
}

declare module 'koishi' {
  interface Tables {
    object: ObjectModel
  }
}

function ObjectOperations(app: App) {
  app.model.extend('object', {
    'id': 'string',
    'meta.a': 'string',
    'meta.embed': { type: 'json' },
  })
}

namespace ObjectOperations {
  async function setup(app: App) {
    await app.database.remove('object', {})
    const result: ObjectModel[] = []
    result.push(await app.database.create('object', { id: '0', meta: { embed: { b: 2 } } }))
    result.push(await app.database.create('object', { id: '1' }))
    expect(result).to.have.length(2)
    return result
  }

  export const upsert = function Upsert(app: App) {
    it.only('object literal', async () => {
      const table = await setup(app)
      table[0].meta = { a: '0', embed: { b: 114 } }
      table[1].meta = { a: '1', embed: { b: 514 } }
      table.push({ id: '2', meta: { a: '2', embed: { b: 1919 } } })
      table.push({ id: '3', meta: { a: '3', embed: { b: 810 } } })
      await expect(app.database.upsert('object', [
        { id: '0', meta: { a: { $: 'id' }, embed: { b: 114 } } },
        { id: '1', meta: { a: { $: 'id' }, 'embed.b': 514 } },
        { id: '2', meta: { a: { $: 'id' }, embed: { b: 1919 } } },
        { id: '3', meta: { a: { $: 'id' }, 'embed.b': 810 } },
      ])).eventually.fulfilled
      await expect(app.database.get('object', {})).to.eventually.have.shape(table)
    })

    it('nested property', async () => {
      const table = await setup(app)
      table[0].meta = { a: '0', embed: { b: 114 } }
      table[1].meta = { a: '1', embed: { b: 514 } }
      table.push({ id: '2', meta: { a: '2', embed: { b: 1919 } } })
      table.push({ id: '3', meta: { a: '3', embed: { b: 810 } } })
      await expect(app.database.upsert('object', [
        { id: '0', 'meta.a': { $: 'id' }, 'meta.embed.b': 114 },
        { id: '1', 'meta.a': { $: 'id' }, 'meta.embed': { b: 514 } },
        { id: '2', 'meta.a': { $: 'id' }, 'meta.embed.b': 1919 },
        { id: '3', 'meta.a': { $: 'id' }, 'meta.embed': { b: 810 } },
      ])).eventually.fulfilled
      await expect(app.database.get('object', {})).to.eventually.have.shape(table)
    })
  }

  export const modify = function Modify(app: App) {
    it('object literal', async () => {
      const table = await setup(app)
      table[0].meta = { a: '0', embed: { b: 114 } }
      table[1].meta = { a: '1', embed: { b: 514 } }
      await expect(app.database.set('object', '0', {
        meta: { a: { $: 'id' }, embed: { b: 114 } },
      })).eventually.fulfilled
      await expect(app.database.set('object', '1', {
        meta: { a: { $: 'id' }, 'embed.b': 514 },
      })).eventually.fulfilled
      await expect(app.database.get('object', {})).to.eventually.have.shape(table)
    })

    it('nested property', async () => {
      const table = await setup(app)
      table[0].meta = { a: '0', embed: { b: 114 } }
      table[1].meta = { a: '1', embed: { b: 514 } }
      await expect(app.database.set('object', '0', {
        'meta.a': { $: 'id' },
        'meta.embed.b': 114,
      })).eventually.fulfilled
      await expect(app.database.set('object', '1', {
        'meta.a': { $: 'id' },
        'meta.embed': { b: 514 },
      })).eventually.fulfilled
      await expect(app.database.get('object', {})).to.eventually.have.shape(table)
    })
  }
}

export default ObjectOperations
