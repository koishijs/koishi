import { App, User, Channel } from 'koishi-core'
import { expect } from 'chai'
import '../chai'

export function createArray<T>(length: number, create: (index: number) => T) {
  return Array(length).fill(undefined).map((_, index) => create(index))
}

export function testDatabase(app: App) {
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

    await db.removeUser('mock', 'A')
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

    await db.removeChannel('mock', 'A')
    await expect(db.getChannel('mock', ['A'])).eventually.to.deep.equal([])
  })

  return db
}
