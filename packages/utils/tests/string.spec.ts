import { interpolate, escapeRegExp } from 'koishi'
import { expect } from 'chai'

describe('String Manipulations', () => {
  it('interpolate', () => {
    expect(interpolate('foo{{ bar }}foo', { bar: 'baz' })).to.equal('foobazfoo')
    expect(interpolate('foo{{ bar }}foo', {})).to.equal('foofoo')
  })

  it('escape regexp', () => {
    expect(escapeRegExp('\\^$*+?.()|{}[]-')).to.equal('\\\\\\^\\$\\*\\+\\?\\.\\(\\)\\|\\{\\}\\[\\]\\x2d')
  })
})
