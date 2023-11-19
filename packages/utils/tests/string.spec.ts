import { interpolate, escapeRegExp } from 'koishi'
import { expect } from 'chai'

describe('String Manipulations', () => {
  it('interpolate', () => {
    expect(interpolate('foo{{ bar }}foo', { bar: 'baz' })).to.equal('foobazfoo')
    expect(interpolate('foo{{ bar }}foo', {})).to.equal('foofoo')
    expect(interpolate('{{ bar }}', {})).to.equal(undefined)
    expect(interpolate('{{ +bar }}', { bar: '2' })).to.equal(2)
  })

  it('escape regexp', () => {
    expect(escapeRegExp('\\^$*+?.()|{}[]-')).to.equal('\\\\\\^\\$\\*\\+\\?\\.\\(\\)\\|\\{\\}\\[\\]\\x2d')
  })
})
