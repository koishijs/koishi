import { App } from 'koishi'
import { expect } from 'chai'

interface ObjectModel {
  id: number
  meta?: {
    a?: number
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
    'id': 'unsigned',
    'meta.a': 'integer',
    'meta.embed': { type: 'json' },
  }, {
    autoInc: true,
  })
}

namespace ObjectOperations {
  async function setup(app: App) {
    await app.database.remove('object', {})
    const result: ObjectModel[] = []
    result.push(await app.database.create('object', { id: 0, meta: { embed: { b: 2 } } }))
    result.push(await app.database.create('object', { id: 1 }))
    expect(result).to.have.length(2)
    return result
  }

  export const literal = function Literal(app: App) {
    it('upsert nested property', async () => {
      const table = await setup(app)
      table[0].meta.a = -1
      table[0].meta.embed = { b: 114 }
      table[1].meta.a = -2
      table[1].meta.embed = { b: 514 }
      table.push({ id: 2, meta: { a: -3, embed: { b: 1919 } } })
      table.push({ id: 3, meta: { a: -4, embed: { b: 810 } } })
      await expect(app.database.upsert('object', [
        { id: 0, 'meta.a': -1, 'meta.embed.b': 114 },
        { id: 1, meta: { a: -2, 'embed.b': 514 } },
        { id: 2, 'meta.a': -3, 'meta.embed': { b: 1919 } },
        { id: 3, meta: { a: -4, embed: { b: 810 } } },
      ])).eventually.fulfilled
      await expect(app.database.get('object', {})).to.eventually.have.shape(table)
    })

    it('modify nested property', async () => {
      const table = await setup(app)
      table[1].meta = { a: 1, embed: { b: 233 } }
      await expect(app.database.set('object', [1, 10], {
        meta: { a: { $: 'id' }, embed: { b: 233 } },
      })).eventually.fulfilled
      await expect(app.database.get('object', {})).to.eventually.have.shape(table)
    })

    it('modify nested property', async () => {
      const table = await setup(app)
      table[1].meta = { a: 1, embed: { b: 233 } }
      await expect(app.database.set('object', [1, 10], {
        meta: { a: { $: 'id' }, 'embed.b': 233 },
      })).eventually.fulfilled
      await expect(app.database.get('object', {})).to.eventually.have.shape(table)
    })

    it('modify nested property 2', async () => {
      const table = await setup(app)
      table[1].meta = { a: 1, embed: { b: 233 } }
      await expect(app.database.set('object', [1, 10], {
        'meta.a': { $: 'id' },
        'meta.embed': { b: 233 },
      })).eventually.fulfilled
      await expect(app.database.get('object', {})).to.eventually.have.shape(table)
    })

    it('modify nested property 2', async () => {
      const table = await setup(app)
      table[1].meta = { a: 1, embed: { b: 233 } }
      await expect(app.database.set('object', [1, 10], {
        'meta.a': { $: 'id' },
        'meta.embed.b': 233,
      })).eventually.fulfilled
      await expect(app.database.get('object', {})).to.eventually.have.shape(table)
    })
  }
}

export default ObjectOperations
