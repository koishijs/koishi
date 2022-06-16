import { App } from 'koishi'
import { expect, use } from 'chai'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'
import shape from 'chai-shape'
import promise from 'chai-as-promised'

use(shape)
use(promise)

const app = new App()

app.plugin(mock)
app.plugin(memory)

before(() => app.start())
after(() => app.stop())

describe('Database API', () => {
  describe('User Operations', () => {
    it('db.setUser() on non-existing user', async () => {
      await app.database.setUser('mock', 'A', { authority: 1 })
      await expect(app.database.getUser('mock', 'A')).eventually.not.to.be.ok
    })

    it('db.createUser() on non-existing user', async () => {
      await app.database.createUser('mock', 'A', { authority: 1 })
      await expect(app.database.getUser('mock', 'A')).eventually.to.have.shape({ authority: 1 })
    })

    it('db.setUser() on existing user', async () => {
      await app.database.setUser('mock', 'A', { authority: 2 })
      await expect(app.database.getUser('mock', 'A')).eventually.to.have.shape({ authority: 2 })
    })

    it('db.getUser() with multiple ids', async () => {
      await expect(app.database.getUser('mock', ['A'])).eventually.to.have.length(1)
      await app.database.remove('user', { mock: ['A'] })
      await expect(app.database.getUser('mock', ['A'])).eventually.to.have.length(0)
    })
  })

  describe('Channel Operations', () => {
    it('db.setChannel() on non-existing channel', async () => {
      await app.database.setChannel('mock', 'A', { assignee: '123' })
      await expect(app.database.getChannel('mock', 'A')).eventually.not.to.be.ok
    })

    it('db.createChannel() on non-existing channel', async () => {
      await app.database.createChannel('mock', 'A', { assignee: '123' })
      await expect(app.database.getChannel('mock', 'A')).eventually.to.have.shape({ assignee: '123' })
    })

    it('db.setChannel() on existing channel', async () => {
      await app.database.setChannel('mock', 'A', { assignee: '321' })
      await expect(app.database.getChannel('mock', 'A')).eventually.to.have.shape({ assignee: '321' })
    })

    it('db.getAssignedChannels()', async () => {
      await app.database.createChannel('mock', 'B', { assignee: app.bots[0].selfId })
      await app.database.createChannel('mock', 'C', { assignee: app.bots[0].selfId })
      await expect(app.database.getAssignedChannels(null)).eventually.to.have.length(2)
      await expect(app.database.getAssignedChannels(null, { mock: ['321'] })).eventually.to.have.length(1)
    })

    it('db.getChannel() with multiple ids', async () => {
      await expect(app.database.getChannel('mock', ['A'])).eventually.to.have.length(1)
      await app.database.remove('channel', { id: 'A' })
      await expect(app.database.getChannel('mock', ['A'])).eventually.to.deep.equal([])
    })
  })
})
