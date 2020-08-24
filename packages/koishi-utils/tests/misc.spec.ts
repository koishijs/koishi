import { expect } from 'chai'
import { coerce, enumKeys, assertProperty, defineProperty, pick, omit } from 'koishi-utils'

describe('Miscellaneous', () => {
  it('coerce', () => {
    expect(coerce('foo')).to.match(/^Error: foo/)
    expect(coerce(new Error('foo'))).to.match(/^Error: foo/)
  })

  it('enumKeys', () => {
    enum Foo { bar, baz }
    expect(enumKeys(Foo)).to.deep.equal(['bar', 'baz'])
  })

  it('defineProperty', () => {
    const object = {}
    defineProperty(object, 'foo', 'bar')
    expect(object).to.have.property('foo', 'bar')
  })

  it('assertProperty', () => {
    expect(assertProperty({ foo: 'bar' }, 'foo')).to.equal('bar')
    expect(() => assertProperty({}, 'foo' as never)).to.throw('missing configuration "foo"')
  })

  it('pick', () => {
    expect(pick({ a: 1, b: [2] }, ['b'])).to.deep.equal({ b: [2] })
  })

  it('omit', () => {
    expect(omit({ a: 1, b: [2] }, ['b'])).to.deep.equal({ a: 1 })
  })
})
