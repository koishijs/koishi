import { capitalize, camelCase, paramCase, snakeCase } from '../src'

describe('string operations', () => {
  test('capitalize', () => {
    expect(capitalize('aa-aa_aA')).toBe('Aa-aa_aA')
  })

  test('camel case', () => {
    expect(camelCase('aa-aa_aA')).toBe('aaAaAA')
    expect(camelCase({ 'a_b': [{ 'c-d': 'e_f' }] })).toMatchObject({ aB: [{ cD: 'e_f' }] })
  })

  test('param case', () => {
    expect(paramCase('aa-aa_aA')).toBe('aa-aa-a-a')
    expect(paramCase({ 'aB': [{ 'c_d': 'eF' }] })).toMatchObject({ 'a-b': [{ 'c-d': 'eF' }] })
  })

  test('snake case', () => {
    expect(snakeCase('aa-aa_aA')).toBe('aa_aa_a_a')
    expect(snakeCase({ 'a-b': [{ 'cD': 'e-f' }] })).toMatchObject({ 'a_b': [{ 'c_d': 'e-f' }] })
  })
})
