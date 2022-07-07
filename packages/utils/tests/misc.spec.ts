import { expect } from 'chai'
import { coerce, enumKeys, assertProperty } from 'koishi'

describe('Miscellaneous', () => {
  it('coerce', () => {
    expect(coerce('foo')).to.match(/^Error: foo/)
    expect(coerce(new Error('foo'))).to.match(/^Error: foo/)
  })

  it('enumKeys', () => {
    enum Foo { bar, baz }
    expect(enumKeys(Foo)).to.deep.equal(['bar', 'baz'])
  })

  it('assertProperty', () => {
    expect(assertProperty({ foo: 'bar' }, 'foo')).to.equal('bar')
    expect(() => assertProperty({}, 'foo' as never)).to.throw('missing configuration "foo"')
  })
})
