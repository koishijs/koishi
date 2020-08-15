import { App } from 'koishi-test-utils'
import { expect } from 'chai'
import '@shigma/chai-extended'

let app: App

describe('register commands', () => {
  before(() => app = new App())

  it('constructor checks', () => {
    expect(() => app.command('')).to.throw()
  })

  it('context.command', () => {
    const ctx1 = app.user(10000)
    const ctx2 = app.group(10000)
    app.command('a')
    ctx1.command('b')
    ctx2.command('c')

    // a, b, c, help
    expect(app._commands).to.have.length(4)
    expect(app._commandMap.a.context).to.equal(app)
    expect(app._commandMap.b.context).to.equal(ctx1)
    expect(app._commandMap.c.context).to.equal(ctx2)
  })

  it('modify commands', () => {
    const d1 = app.command('d', 'foo', { authority: 1 })
    expect(app._commandMap.d.config.description).to.equal('foo')
    expect(app._commandMap.d.config.authority).to.equal(1)

    const d2 = app.command('d', { description: 'bar', authority: 2 })
    expect(app._commandMap.d.config.description).to.equal('bar')
    expect(app._commandMap.d.config.authority).to.equal(2)

    expect(d1).to.equal(d2)
  })

  it('name conflicts', () => {
    expect(() => {
      app.command('e')
      app.user(10000).command('e')
    }).not.to.throw()

    expect(() => {
      const x1 = app.command('e').alias('x')
      const x2 = app.user(10000).command('x')
      expect(x1).to.equal(x2)
    }).not.to.throw()

    expect(() => {
      app.command('g').alias('y')
      app.command('h').alias('y')
    }).to.throw()

    expect(() => {
      app.command('i').alias('z')
      app.command('i').alias('z')
    }).not.to.throw()
  })
})

describe('register subcommands', () => {
  beforeEach(() => app = new App())

  it('command.subcommand', () => {
    const a = app.command('a')
    const b = a.subcommand('b')
    const c = b.subcommand('.c')
    expect(a.children).to.have.shape([b])
    expect(b.name).to.equal('b')
    expect(b.parent).to.equal(a)
    expect(b.children).to.have.shape([c])
    expect(c.name).to.equal('b.c')
    expect(c.parent).to.equal(b)
  })

  it('implicit subcommands', () => {
    const a = app.command('a')
    const d = app.command('a.d')
    expect(d.name).to.equal('a.d')
    expect(d.parent).to.equal(a)

    const b = app.command('b')
    const e = app.command('b/e')
    expect(e.name).to.equal('e')
    expect(e.parent).to.equal(b)

    const f = a.subcommand('.b/f')
    expect(f.name).to.equal('f')
    expect(f.parent.name).to.equal('a.b')
    expect(f.parent.parent).to.equal(a)

    const g = b.subcommand('c.g')
    expect(g.name).to.equal('c.g')
    expect(g.parent.name).to.equal('c')
    expect(g.parent.parent).to.equal(b)

    const h = app.command('h')
    b.subcommand('h')
    expect(h.name).to.equal('h')
    expect(h.parent).to.equal(b)
  })

  it('check subcommand', () => {
    const a = app.command('a')
    const b = a.subcommand('b')
    const c = b.subcommand('c')
    const d = app.command('d')

    // register explicit subcommand
    expect(() => a.subcommand('a')).to.throw()
    expect(() => a.subcommand('b')).not.to.throw()
    expect(() => a.subcommand('c')).to.throw()
    expect(() => a.subcommand('d')).not.to.throw()

    // register implicit subcommand
    expect(() => app.command('b/c')).not.to.throw()
    expect(() => app.command('a/c')).to.throw()
    expect(() => app.command('c/b')).to.throw()
    expect(() => app.command('a/d')).not.to.throw()
  })
})
