import { App } from 'koishi'
import { expect } from 'chai'
import mock from '@koishijs/plugin-mock'

const app = new App().plugin(mock)
const guildSession = app.mock.session({ userId: '123', guildId: '456', subtype: 'group' })
const privateSession = app.mock.session({ userId: '123', subtype: 'private' })

describe('Selector API', () => {
  it('root context', () => {
    expect(app.match(guildSession)).to.be.true
    expect(app.match(privateSession)).to.be.true
  })

  it('context.prototype.user', () => {
    expect(app.user().match(guildSession)).to.be.true
    expect(app.user().match(privateSession)).to.be.true
    expect(app.user('123').match(guildSession)).to.be.true
    expect(app.user('123').match(privateSession)).to.be.true
    expect(app.user('456').match(guildSession)).to.be.false
    expect(app.user('456').match(privateSession)).to.be.false
  })

  it('context.prototype.private', () => {
    expect(app.private().match(guildSession)).to.be.false
    expect(app.private().match(privateSession)).to.be.true
    expect(app.private().user('123').match(guildSession)).to.be.false
    expect(app.private().user('123').match(privateSession)).to.be.true
    expect(app.private().user('456').match(guildSession)).to.be.false
    expect(app.private().user('456').match(privateSession)).to.be.false
  })

  it('context.prototype.guild', () => {
    expect(app.guild().match(guildSession)).to.be.true
    expect(app.guild().match(privateSession)).to.be.false
    expect(app.guild('123').match(guildSession)).to.be.false
    expect(app.guild('123').match(privateSession)).to.be.false
    expect(app.guild('456').match(guildSession)).to.be.true
    expect(app.guild('456').match(privateSession)).to.be.false
  })

  it('context chaining', () => {
    expect(app.guild('456').user('123').match(guildSession)).to.be.true
    expect(app.guild('456').user('456').match(guildSession)).to.be.false
    expect(app.guild('123').user('123').match(guildSession)).to.be.false
    expect(app.user('123').guild('456').match(guildSession)).to.be.true
    expect(app.user('456').guild('456').match(guildSession)).to.be.false
    expect(app.user('123').guild('123').match(guildSession)).to.be.false
  })

  it('context intersection', () => {
    expect(app.guild('456', '789').guild('123', '456').match(guildSession)).to.be.true
    expect(app.guild('456', '789').guild('123', '789').match(guildSession)).to.be.false
    expect(app.guild('123', '789').guild('123', '456').match(guildSession)).to.be.false
    expect(app.user('123', '789').user('123', '456').match(guildSession)).to.be.true
    expect(app.user('456', '789').user('123', '456').match(guildSession)).to.be.false
    expect(app.user('123', '789').user('456', '789').match(guildSession)).to.be.false
  })
})
