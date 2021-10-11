import { App } from 'koishi'
import { expect } from 'chai'
import '../../chai'
import '../app'

export default function BuiltinMethods(app: App) {
  const { database: db } = app

  describe('User Operations', () => {
    it('db.setUser() on non-existing user', async () => {
      await db.setUser('mock', 'A', { authority: 1 })
      await expect(db.getUser('mock', 'A')).eventually.not.to.be.ok
    })

    it('db.createUser() on non-existing user', async () => {
      await db.createUser('mock', 'A', { authority: 1 })
      await expect(db.getUser('mock', 'A')).eventually.to.have.shape({ authority: 1 })
    })

    it('db.setUser() on existing user', async () => {
      await db.setUser('mock', 'A', { authority: 2 })
      await expect(db.getUser('mock', 'A')).eventually.to.have.shape({ authority: 2 })
    })

    it('db.getUser() with multiple ids', async () => {
      await expect(db.getUser('mock', ['A'])).eventually.to.have.length(1)
      await db.remove('user', { mock: ['A'] })
      await expect(db.getUser('mock', ['A'])).eventually.to.have.length(0)
    })
  })

  describe('Channel Operations', () => {
    it('db.setChannel() on non-existing channel', async () => {
      await db.setChannel('mock', 'A', { assignee: '123' })
      await expect(db.getChannel('mock', 'A')).eventually.not.to.be.ok
    })

    it('db.createChannel() on non-existing channel', async () => {
      await db.createChannel('mock', 'A', { assignee: '123' })
      await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({ assignee: '123' })
    })

    it('db.setChannel() on existing channel', async () => {
      await db.setChannel('mock', 'A', { assignee: '321' })
      await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({ assignee: '321' })
    })

    it('db.getAssignedChannels()', async () => {
      await db.createChannel('mock', 'B', { assignee: app.bots[0].selfId })
      await db.createChannel('mock', 'C', { assignee: app.bots[0].selfId })
      await expect(db.getAssignedChannels(null)).eventually.to.have.length(2)
      await expect(db.getAssignedChannels(null, { mock: ['321'] })).eventually.to.have.length(1)
    })

    it('db.getChannel() with multiple ids', async () => {
      await expect(db.getChannel('mock', ['A'])).eventually.to.have.length(1)
      await db.remove('channel', { id: 'A' })
      await expect(db.getChannel('mock', ['A'])).eventually.to.deep.equal([])
    })
  })
}
