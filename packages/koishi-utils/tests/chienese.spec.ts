import { simplify, traditionalize } from '../src'

describe('Chinese', () => {
  test('simplify', () => {
    expect(simplify('Hello world. 這是一段繁體字。')).toBe('Hello world. 这是一段繁体字。')
  })

  test('traditionalize', () => {
    expect(traditionalize('Hello world. 这是一段简体字。')).toBe('Hello world. 這是一段簡體字。')
  })
})
