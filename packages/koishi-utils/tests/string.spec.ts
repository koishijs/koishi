import { capitalize, camelCase, paramCase, snakeCase } from '../src'
import { expect } from 'chai'

describe('string operations', () => {
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
})
