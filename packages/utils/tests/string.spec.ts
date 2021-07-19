import { capitalize, camelCase, paramCase, snakeCase, interpolate, escapeRegExp } from 'koishi'
import { expect } from 'chai'

describe('String Manipulations', () => {
  it('capitalize', () => {
    expect(capitalize('aa-aa_aA')).to.equal('Aa-aa_aA')
  })

  it('camel case', () => {
    expect(camelCase('aa-aa_aA')).to.equal('aaAaAA')
    expect(camelCase({ a_b: [{ 'c-d': 'e_f' }] })).to.deep.equal({ aB: [{ cD: 'e_f' }] })
  })

  it('param case', () => {
    expect(paramCase('aa-aa_aA')).to.equal('aa-aa-a-a')
    expect(paramCase({ aB: [{ c_d: 'eF' }] })).to.deep.equal({ 'a-b': [{ 'c-d': 'eF' }] })
  })

  it('snake case', () => {
    expect(snakeCase('aa-aa_aA')).to.equal('aa_aa_a_a')
    expect(snakeCase({ 'a-b': [{ cD: 'e-f' }] })).to.deep.equal({ a_b: [{ c_d: 'e-f' }] })
  })

  it('interpolate', () => {
    expect(interpolate('foo{{ bar }}foo', { bar: 'baz' })).to.equal('foobazfoo')
    expect(interpolate('foo{{ bar }}foo', {})).to.equal('foofoo')
  })

  it('escape regexp', () => {
    expect(escapeRegExp('\\^$*+?.()|{}[]-')).to.equal('\\\\\\^\\$\\*\\+\\?\\.\\(\\)\\|\\{\\}\\[\\]\\x2d')
  })
})
