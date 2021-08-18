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

Tables.extend('foo')

export namespace ORMTests {
  export function builtin(app: App) {
    const { database: db } = app

    before(() => app.start())
    after(() => app.stop())

    it('user operations', async () => {
      await db.setUser('mock', 'A', User.create('mock', 'A'))
      await expect(db.getUser('mock', 'A')).eventually.not.to.be.ok

      await db.initUser('A', 1)
      await expect(db.getUser('mock', 'A')).eventually.to.have.shape({
        mock: 'A',
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

      await db.initChannel('A', '123')
      await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({
        id: 'mock:A',
        assignee: '123',
      })

      await db.setChannel('mock', 'A', { assignee: '321' })
      await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({
        assignee: '321',
      })

      await db.initChannel('B')
      await db.initChannel('C')
      await expect(db.getAssignedChannels(null)).eventually.to.have.length(2)
      await expect(db.getAssignedChannels(null, { mock: ['321'] })).eventually.to.have.length(1)

      await db.remove('channel', { id: ['mock:A'] })
      await expect(db.getChannel('mock', ['A'])).eventually.to.deep.equal([])
    })
  }

  export namespace query {
    export function expr(app: App) {
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
    }
  }
}
