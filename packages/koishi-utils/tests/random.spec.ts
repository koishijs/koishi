import { randomId, randomBool, randomReal, randomInt, randomPick, randomSplice, randomMultiPick, randomWeightedPick, isInteger } from '../src'
import { expect } from 'chai'

describe('Random Manipulations', () => {
  it('randomId', () => {
    expect(randomId()).to.have.length(8)
    expect(randomId(10)).to.have.length(10)
  })

  it('randomBool', () => {
    for (let i = 0; i < 10; ++i) {
      expect(typeof randomBool(0.5)).to.equal('boolean')
      expect(randomBool(0)).to.equal(false)
      expect(randomBool(1)).to.equal(true)
    }
  })

  it('randomReal', () => {
    let value: number
    for (let i = 0; i < 10; ++i) {
      value = randomReal(2, 5)
      expect(value < 5 && value >= 2).to.equal(true)
      value = randomReal(5)
      expect(value < 5 && value >= 0).to.equal(true)
    }
  })

  it('randomInt', () => {
    let value: number
    for (let i = 0; i < 10; ++i) {
      value = randomInt(2, 5.9)
      expect(value <= 5 && value >= 2 && isInteger(value)).to.equal(true)
      value = randomInt(5.9)
      expect(value <= 5 && value >= 0 && isInteger(value)).to.equal(true)
    }
  })

  it('randomPick', () => {
    const source = new Array(10).fill(undefined).map((_, index) => index)
    const value = randomPick(source)
    expect(value < 10 && value >= 0 && isInteger(value)).to.equal(true)
    expect(source).to.have.length(10)
  })

  it('randomSplice', () => {
    const source = new Array(10).fill(undefined).map((_, index) => index)
    const value = randomSplice(source)
    expect(value < 10 && value >= 0 && isInteger(value)).to.equal(true)
    expect(source).to.have.length(9)
    expect(source.indexOf(value)).to.equal(-1)
  })

  it('randomMultiPick', () => {
    const source = new Array(10).fill(undefined).map((_, index) => index)
    const values = randomMultiPick(source, 5)
    values.forEach(value => expect(value < 10 && value >= 0 && isInteger(value)).to.equal(true))
    expect(values).to.have.length(5)
    expect(source).to.have.length(10)
  })

  it('randomWeightedPick', () => {
    const source: Record<string, number> = {}
    for (let index = 0; index < 10; ++index) source[index] = index
    const value = +randomWeightedPick(source)
    expect(value < 10 && value >= 0 && isInteger(value)).to.equal(true)
    expect(Object.keys(source)).to.have.length(10)
  })
})
