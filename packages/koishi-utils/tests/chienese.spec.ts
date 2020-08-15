import { simplify, traditionalize } from '../src'
import { expect } from 'chai'

describe('Chinese', () => {
  it('simplify', () => {
    expect(simplify('Hello world. 這是一段繁體字。')).to.equal('Hello world. 这是一段繁体字。')
  })

  it('traditionalize', () => {
    expect(traditionalize('Hello world. 这是一段简体字。')).to.equal('Hello world. 這是一段簡體字。')
  })
})
