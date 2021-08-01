import 'koishi-test-utils'
import { expect } from 'chai'
import { Random } from 'koishi-core'

describe('Chai Extensions', () => {
  it('shape', () => {
    expect(1).to.have.shape(1)
    expect(NaN).to.have.shape(NaN)
    expect(true).to.have.shape(true)
    expect('foo').to.have.shape('foo')

    const random = Random.int(1 << 20)
    expect(new Date(random)).to.have.shape(new Date(random))
    expect({ a: 1, b: 2 }).to.have.shape({ a: 1 })
    expect([1, 2]).to.have.shape([1])

    expect(() => expect(1).to.have.shape(2))
      .to.throw('expected to have 2 but got 1 at path /')
    expect(() => expect(null).to.have.shape(/(?:)/))
      .to.throw('expected to have a regexp but got null at path /')
    expect(() => expect(new Date(0)).to.have.shape(new Date(1000)))
      .to.throw('expected to have 1970-01-01T00:00:01.000Z but got 1970-01-01T00:00:00.000Z at path /')
    expect(() => expect({ a: 1 }).to.have.shape({ a: 1, b: 2 }))
      .to.throw('expected "b" field to be defined at path /')
    expect(() => expect([1]).to.have.shape([1, 2]))
      .to.throw('expected "1" field to be defined at path /')
    expect(() => expect([[1, 2], { a: 3, b: 4 }]).to.have.shape([[1], { a: 4 }]))
      .to.throw('expected to have 4 but got 3 at path /1/a/')
  })
})
