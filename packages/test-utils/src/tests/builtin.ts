import { App, User, Channel } from 'koishi'
import { expect } from 'chai'
import '../../chai'

export default function BuiltinMethods(app: App) {
  const { database: db } = app

  it('user operations', async () => {
    await db.setUser('mock', 'A', User.create('mock', 'A'))
    await expect(db.getUser('mock', 'A')).eventually.not.to.be.ok

    // @ts-ignore FIXME
    await db.createUser('mock', 'A', { authority: 1 })
    await expect(db.getUser('mock', 'A')).eventually.to.have.shape({ authority: 1 })

    await db.setUser('mock', 'A', { authority: 2 })
    await expect(db.getUser('mock', 'A')).eventually.to.have.shape({ authority: 2 })

    await db.remove('user', { mock: ['A'] })
    await expect(db.getUser('mock', ['A'])).eventually.to.deep.equal([])
  })

  it('channel operations', async () => {
    await db.setChannel('mock', 'A', Channel.create('mock', 'A'))
    await expect(db.getChannel('mock', 'A')).eventually.not.to.be.ok

    // @ts-ignore FIXME
    await db.createChannel('mock', 'A', { assignee: '123' })
    await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({ assignee: '123' })

    await db.setChannel('mock', 'A', { assignee: '321' })
    await expect(db.getChannel('mock', 'A')).eventually.to.have.shape({ assignee: '321' })

    // @ts-ignore FIXME
    await db.createChannel('mock', 'B', { assignee: app.bots[0].selfId })
    // @ts-ignore FIXME
    await db.createChannel('mock', 'C', { assignee: app.bots[0].selfId })
    await expect(db.getAssignedChannels(null)).eventually.to.have.length(2)
    await expect(db.getAssignedChannels(null, { mock: ['321'] })).eventually.to.have.length(1)

    await db.remove('channel', { id: ['mock:A'] })
    await expect(db.getChannel('mock', ['A'])).eventually.to.deep.equal([])
  })
}
