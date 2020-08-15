import { observe, noop } from '../src'
import { fn } from 'jest-mock'
import { expect } from 'chai'
import 'koishi-test-utils'

describe('Observer API', () => {
  it('type checks', () => {
    expect(() => observe(1 as never)).to.throw()
    expect(() => observe('2' as never)).to.throw()
    expect(() => observe(/./ as never)).to.throw()
    expect(() => observe(BigInt(3) as never)).to.throw()
    expect(() => observe(true as never)).to.throw()
    expect(() => observe(noop as never)).to.throw()
    expect(() => observe(Symbol('foo') as never)).to.throw()
    expect(() => observe(Symbol.for('foo') as never)).to.throw()
    expect(() => observe(null as never)).to.throw()
    expect(() => observe(undefined as never)).to.throw()
    // eslint-disable-next-line no-array-constructor
    expect(() => observe(new Array())).to.throw()
    expect(() => observe(new Date())).to.throw()
    expect(() => observe(new Set())).to.throw()
    expect(() => observe(new Map())).to.throw()
    expect(() => observe(new WeakSet())).to.throw()
    expect(() => observe(new WeakMap())).to.throw()
  })

  it('observe property', () => {
    const target: Record<string, number> = { a: 1, b: 2 }
    const object = observe(target)
    expect(object._diff).to.have.shape({})

    object.a = 1
    expect(object).to.have.shape({ a: 1, b: 2 })
    expect(object._diff).to.have.shape({})

    object.a = 2
    expect(object).to.have.shape({ a: 2, b: 2 })
    expect(object._diff).to.have.shape({ a: 2 })

    object.c = 3
    expect(object).to.have.shape({ a: 2, b: 2, c: 3 })
    expect(object._diff).to.have.shape({ a: 2, c: 3 })

    delete object.b
    expect(object).to.have.shape({ a: 2, c: 3 })
    expect(object._diff).to.have.shape({ a: 2, c: 3 })

    delete object.c
    expect(object).to.have.shape({ a: 2 })
    expect(object._diff).to.have.shape({ a: 2 })
  })

  it('deep observe', () => {
    const object = observe<any>({ a: { b: 1 }, c: [{ d: 2 }], x: [{ y: 3 }] })
    expect(object._diff).to.have.shape({})

    object.a.e = 3
    expect(object).to.have.shape({ a: { b: 1, e: 3 }, c: [{ d: 2 }], x: [{ y: 3 }] })
    expect(object._diff).to.have.shape({ a: { b: 1, e: 3 } })

    object.c.push({ f: 4 })
    expect(object).to.have.shape({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 3 }] })
    expect(object._diff).to.have.shape({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }] })

    object.x[0].y = 4
    expect(object).to.have.shape({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }] })
    expect(object._diff).to.have.shape({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }] })

    object.x[1] = [5]
    expect(object).to.have.shape({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }, [5]] })
    expect(object._diff).to.have.shape({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }, [5]] })

    delete object.a.b
    expect(object).to.have.shape({ a: { e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }, [5]] })
    expect(object._diff).to.have.shape({ a: { e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }, [5]] })
  })

  it('flush changes', () => {
    const flush = fn()
    const object = observe({ a: 1, b: [2] }, flush)
    expect(object._diff).to.have.shape({})

    object._update()
    expect(flush.mock.calls).to.have.length(0)

    object.b.shift()
    expect(object).to.have.shape({ a: 1, b: [] })
    expect(object._diff).to.have.shape({ b: [] })

    object._update()
    expect(flush.mock.calls).to.have.length(1)
    expect(flush.mock.calls[0]).to.have.shape([{ b: [] }])
    expect(object).to.have.shape({ a: 1, b: [] })
    expect(object._diff).to.have.shape({})

    object.a = 3
    expect(object).to.have.shape({ a: 3, b: [] })
    expect(object._diff).to.have.shape({ a: 3 })

    object._update()
    expect(flush.mock.calls).to.have.length(2)
    expect(flush.mock.calls[1]).to.have.shape([{ a: 3 }])
    expect(object).to.have.shape({ a: 3, b: [] })
    expect(object._diff).to.have.shape({})
  })

  it('merge properties', () => {
    const object = observe<any>({ a: 1 })
    expect(object._diff).to.have.shape({})

    object.a = 2
    expect(object).to.have.shape({ a: 2 })
    expect(object._diff).to.have.shape({ a: 2 })

    object._merge({ b: 3 })
    expect(object).to.have.shape({ a: 2, b: 3 })
    expect(object._diff).to.have.shape({ a: 2 })

    expect(() => object._merge({ a: 3 })).to.throw()
    expect(object).to.have.shape({ a: 2, b: 3 })
    expect(object._diff).to.have.shape({ a: 2 })
  })
})
