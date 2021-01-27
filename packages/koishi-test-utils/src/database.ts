import { App, User, Channel } from 'koishi-core'
import { expect } from 'chai'
import '../chai'

declare module 'koishi-core/dist/database' {
  interface Platforms {
    mock: string
  }
}

export function createArray<T>(length: number, create: (index: number) => T) {
  return Array(length).fill(undefined).map((_, index) => create(index))
}

export function testDatabase(app: App) {
  const { database: db } = app

  before(() => app.start())
  after(() => app.stop())

  it('user operations', async () => {
    await db.setUser('mock', 'A', User.create('mock', 'A', 1))
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

    await db.setUser('mock', 'A', null)
    await expect(db.getUser('mock', ['A'])).eventually.to.deep.equal([])
  })

  it('channel operations', async () => {
    await db.setChannel('mock', 'A', Channel.create('mock', 'A', '123'))
    await expect(db.getChannel('mock', 'A')).eventually.not.to.be.ok

    await db.setChannel('mock', 'A', Channel.create('mock', 'A', '123'), true)
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
    await expect(db.getChannelList(null)).eventually.to.have.length(2)
    await expect(db.getChannelList(null, 'mock')).eventually.to.have.length(2)
    await expect(db.getChannelList(null, 'mock', ['321'])).eventually.to.have.length(1)

    await db.setChannel('mock', 'A', null)
    await expect(db.getChannel('mock', ['A'])).eventually.to.deep.equal([])
  })

  return db
}
