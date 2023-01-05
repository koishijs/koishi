import { Bot, Context } from 'koishi'
import { expect } from 'chai'

const app = new Context()

app.plugin(Bot, {
  platform: 'test',
  selfId: '514',
})

const guildSession = app.bots[0].session({ userId: '123', guildId: '456', subtype: 'group' })
const privateSession = app.bots[0].session({ userId: '123', subtype: 'private' })

describe('Selector API', () => {
  it('root context', () => {
    expect(app.filter(guildSession)).to.be.true
    expect(app.filter(privateSession)).to.be.true
  })

  it('context.prototype.user', () => {
    expect(app.user().filter(guildSession)).to.be.true
    expect(app.user().filter(privateSession)).to.be.true
    expect(app.user('123').filter(guildSession)).to.be.true
    expect(app.user('123').filter(privateSession)).to.be.true
    expect(app.user('456').filter(guildSession)).to.be.false
    expect(app.user('456').filter(privateSession)).to.be.false
  })

  it('context.prototype.private', () => {
    expect(app.private().filter(guildSession)).to.be.false
    expect(app.private().filter(privateSession)).to.be.true
    expect(app.private().user('123').filter(guildSession)).to.be.false
    expect(app.private().user('123').filter(privateSession)).to.be.true
    expect(app.private().user('456').filter(guildSession)).to.be.false
    expect(app.private().user('456').filter(privateSession)).to.be.false
  })

  it('context.prototype.guild', () => {
    expect(app.guild().filter(guildSession)).to.be.true
    expect(app.guild().filter(privateSession)).to.be.false
    expect(app.guild('123').filter(guildSession)).to.be.false
    expect(app.guild('123').filter(privateSession)).to.be.false
    expect(app.guild('456').filter(guildSession)).to.be.true
    expect(app.guild('456').filter(privateSession)).to.be.false
  })

  it('context chaining', () => {
    expect(app.guild('456').user('123').filter(guildSession)).to.be.true
    expect(app.guild('456').user('456').filter(guildSession)).to.be.false
    expect(app.guild('123').user('123').filter(guildSession)).to.be.false
    expect(app.user('123').guild('456').filter(guildSession)).to.be.true
    expect(app.user('456').guild('456').filter(guildSession)).to.be.false
    expect(app.user('123').guild('123').filter(guildSession)).to.be.false
  })

  it('context intersection', () => {
    expect(app.guild('456', '789').guild('123', '456').filter(guildSession)).to.be.true
    expect(app.guild('456', '789').guild('123', '789').filter(guildSession)).to.be.false
    expect(app.guild('123', '789').guild('123', '456').filter(guildSession)).to.be.false
    expect(app.user('123', '789').user('123', '456').filter(guildSession)).to.be.true
    expect(app.user('456', '789').user('123', '456').filter(guildSession)).to.be.false
    expect(app.user('123', '789').user('456', '789').filter(guildSession)).to.be.false
  })
})
