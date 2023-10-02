import { Bot, Context } from 'koishi'
import { expect } from 'chai'

const app = new Context()

app.plugin(Bot, {
  platform: 'test',
  selfId: '514',
})

const session1 = app.bots[0].session()
session1.userId = '123'
session1.channelId = '456'
session1.guildId = '456'
session1.isDirect = false

const session2 = app.bots[0].session()
session2.userId = '123'
session2.channelId = '123'
session2.isDirect = true

describe('Selector API', () => {
  it('root context', () => {
    expect(app.filter(session1)).to.be.true
    expect(app.filter(session2)).to.be.true
  })

  it('context.prototype.user', () => {
    expect(app.user().filter(session1)).to.be.true
    expect(app.user().filter(session2)).to.be.true
    expect(app.user('123').filter(session1)).to.be.true
    expect(app.user('123').filter(session2)).to.be.true
    expect(app.user('456').filter(session1)).to.be.false
    expect(app.user('456').filter(session2)).to.be.false
  })

  it('context.prototype.private', () => {
    expect(app.private().filter(session1)).to.be.false
    expect(app.private().filter(session2)).to.be.true
    expect(app.private().user('123').filter(session1)).to.be.false
    expect(app.private().user('123').filter(session2)).to.be.true
    expect(app.private().user('456').filter(session1)).to.be.false
    expect(app.private().user('456').filter(session2)).to.be.false
  })

  it('context.prototype.guild', () => {
    expect(app.guild().filter(session1)).to.be.true
    expect(app.guild().filter(session2)).to.be.false
    expect(app.guild('123').filter(session1)).to.be.false
    expect(app.guild('123').filter(session2)).to.be.false
    expect(app.guild('456').filter(session1)).to.be.true
    expect(app.guild('456').filter(session2)).to.be.false
  })

  it('context chaining', () => {
    expect(app.guild('456').user('123').filter(session1)).to.be.true
    expect(app.guild('456').user('456').filter(session1)).to.be.false
    expect(app.guild('123').user('123').filter(session1)).to.be.false
    expect(app.user('123').guild('456').filter(session1)).to.be.true
    expect(app.user('456').guild('456').filter(session1)).to.be.false
    expect(app.user('123').guild('123').filter(session1)).to.be.false
  })

  it('context intersection', () => {
    expect(app.guild('456', '789').guild('123', '456').filter(session1)).to.be.true
    expect(app.guild('456', '789').guild('123', '789').filter(session1)).to.be.false
    expect(app.guild('123', '789').guild('123', '456').filter(session1)).to.be.false
    expect(app.user('123', '789').user('123', '456').filter(session1)).to.be.true
    expect(app.user('456', '789').user('123', '456').filter(session1)).to.be.false
    expect(app.user('123', '789').user('456', '789').filter(session1)).to.be.false
  })
})
