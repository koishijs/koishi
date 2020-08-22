import { capitalize, camelCase, paramCase, snakeCase, simplify, traditionalize, escapeRegExp } from '../src'
import { expect } from 'chai'

describe('String Manipulations', () => {
  it('simplify', () => {
    expect(simplify('Hello world. 這是一段繁體字。')).to.equal('Hello world. 这是一段繁体字。')
  })

  it('traditionalize', () => {
    expect(traditionalize('Hello world. 这是一段简体字。')).to.equal('Hello world. 這是一段簡體字。')
  })

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

  it('escape regexp', () => {
    expect(escapeRegExp('\\^$*+?.()|{}[]-')).to.equal('\\\\\\^\\$\\*\\+\\?\\.\\(\\)\\|\\{\\}\\[\\]\\x2d')
  })
})
