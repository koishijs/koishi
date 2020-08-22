import { MockedApp } from 'koishi-test-utils'
import { noop } from 'koishi-utils'
import { expect } from 'chai'
import { fn } from 'jest-mock'
import '@shigma/chai-extended'

const app = new MockedApp()

describe('Plugin API', () => {
  it('call chaining', () => {
    expect(app.plugin(noop)).to.equal(app)

    const ctx = app.user(123)
    expect(ctx.plugin(noop)).to.equal(ctx)
  })

  it('apply functional plugin', () => {
    const callback = fn()
    const options = { foo: 'bar' }
    app.plugin(callback, options)

    expect(callback.mock.calls).to.have.length(1)
    expect(callback.mock.calls[0][1]).to.have.shape(options)
  })

  it('apply object plugin', () => {
    const callback = fn()
    const options = { bar: 'foo' }
    const plugin = { apply: callback }
    app.plugin(plugin, options)

    expect(callback.mock.calls).to.have.length(1)
    expect(callback.mock.calls[0][1]).to.have.shape(options)
  })

  it('apply functional plugin with false', () => {
    const callback = fn()
    app.plugin(callback, false)

    expect(callback.mock.calls).to.have.length(0)
  })

  it('apply object plugin with false', () => {
    const callback = fn()
    const plugin = { apply: callback }
    app.plugin(plugin, false)

    expect(callback.mock.calls).to.have.length(0)
  })

  it('apply invalid plugin', () => {
    expect(() => app.plugin(undefined)).to.throw()
    expect(() => app.plugin({} as any)).to.throw()
    expect(() => app.plugin({ apply: {} } as any)).to.throw()
  })
})
