import { observe, noop, Dict } from 'koishi'
import { expect } from 'chai'
import * as jest from 'jest-mock'

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
    expect(() => observe(new Array())).to.throw()
    expect(() => observe(new Date())).to.throw()
    expect(() => observe(new Set())).to.throw()
    expect(() => observe(new Map())).to.throw()
    expect(() => observe(new WeakSet())).to.throw()
    expect(() => observe(new WeakMap())).to.throw()
  })

  it('observe property', () => {
    const target: Dict<number> = { a: 1, b: 2 }
    const object = observe(target, 'foo')
    expect(object.$diff).to.deep.equal({})

    object.a = 1
    expect(object).to.deep.equal({ a: 1, b: 2 })
    expect(object.$diff).to.deep.equal({})

    object.a = 2
    expect(object).to.deep.equal({ a: 2, b: 2 })
    expect(object.$diff).to.deep.equal({ a: 2 })

    object.c = 3
    expect(object).to.deep.equal({ a: 2, b: 2, c: 3 })
    expect(object.$diff).to.deep.equal({ a: 2, c: 3 })

    delete object.b
    expect(object).to.deep.equal({ a: 2, c: 3 })
    expect(object.$diff).to.deep.equal({ a: 2, b: undefined, c: 3 })

    delete object.c
    expect(object).to.deep.equal({ a: 2 })
    expect(object.$diff).to.deep.equal({ a: 2, b: undefined, c: undefined })
  })

  it('deep observe', () => {
    const object = observe<any>({
      a: { b: 1 },
      c: [{ d: 2 }],
      x: [{ y: 3 }],
    })
    expect(object.$diff).to.deep.equal({})

    object.a.e = 3
    expect(object).to.deep.equal({
      a: { b: 1, e: 3 },
      c: [{ d: 2 }],
      x: [{ y: 3 }],
    })
    expect(object.$diff).to.deep.equal({
      a: { b: 1, e: 3 },
    })

    object.c.push({ f: 4 })
    expect(object).to.deep.equal({
      a: { b: 1, e: 3 },
      c: [{ d: 2 }, { f: 4 }],
      x: [{ y: 3 }],
    })
    expect(object.$diff).to.deep.equal({
      a: { b: 1, e: 3 },
      c: [{ d: 2 }, { f: 4 }],
    })

    object.x[0].y = 4
    expect(object).to.deep.equal({
      a: { b: 1, e: 3 },
      c: [{ d: 2 }, { f: 4 }],
      x: [{ y: 4 }],
    })
    expect(object.$diff).to.deep.equal({
      a: { b: 1, e: 3 },
      c: [{ d: 2 }, { f: 4 }],
      x: [{ y: 4 }],
    })

    object.x[1] = [5]
    expect(object).to.deep.equal({
      a: { b: 1, e: 3 },
      c: [{ d: 2 }, { f: 4 }],
      x: [{ y: 4 }, [5]],
    })
    expect(object.$diff).to.deep.equal({
      a: { b: 1, e: 3 },
      c: [{ d: 2 }, { f: 4 }],
      x: [{ y: 4 }, [5]],
    })

    delete object.a.b
    expect(object).to.deep.equal({
      a: { e: 3 },
      c: [{ d: 2 }, { f: 4 }],
      x: [{ y: 4 }, [5]],
    })
    expect(object.$diff).to.deep.equal({
      a: { e: 3 },
      c: [{ d: 2 }, { f: 4 }],
      x: [{ y: 4 }, [5]],
    })
  })

  it('deep observe new property', () => {
    const object = observe<any>({
      a: [],
    })
    expect(object.$diff).to.deep.equal({})

    object.a.push({ b: 1 })
    expect(object.$diff).to.deep.equal({
      a: [{ b: 1 }],
    })

    object.$update()
    expect(object.$diff).to.deep.equal({})

    object.a[0].b = 2
    expect(object.$diff).to.deep.equal({
      a: [{ b: 2 }],
    })
  })

  it('observe date', () => {
    const object = observe({ foo: new Date() })
    object.foo.getFullYear()
    expect(object.$diff).to.not.have.property('foo')
    object.foo.setFullYear(2000)
    expect(object.$diff).to.have.property('foo')
  })

  it('flush changes', () => {
    const flush = jest.fn()
    const object = observe({ a: 1, b: [2] }, flush)
    expect(object.$diff).to.deep.equal({})

    object.$update()
    expect(flush.mock.calls).to.have.length(0)

    object.b.shift()
    expect(object).to.deep.equal({ a: 1, b: [] })
    expect(object.$diff).to.deep.equal({ b: [] })

    object.$update()
    expect(flush.mock.calls).to.have.length(1)
    expect(flush.mock.calls[0]).to.deep.equal([{ b: [] }])
    expect(object).to.deep.equal({ a: 1, b: [] })
    expect(object.$diff).to.deep.equal({})

    object.a = 3
    expect(object).to.deep.equal({ a: 3, b: [] })
    expect(object.$diff).to.deep.equal({ a: 3 })

    object.$update()
    expect(flush.mock.calls).to.have.length(2)
    expect(flush.mock.calls[1]).to.deep.equal([{ a: 3 }])
    expect(object).to.deep.equal({ a: 3, b: [] })
    expect(object.$diff).to.deep.equal({})
  })

  it('merge properties', () => {
    const object = observe<any>({ a: 1 })
    expect(object.$diff).to.deep.equal({})

    object.a = 2
    expect(object).to.deep.equal({ a: 2 })
    expect(object.$diff).to.deep.equal({ a: 2 })

    object.$merge({ b: 3 })
    expect(object).to.deep.equal({ a: 2, b: 3 })
    expect(object.$diff).to.deep.equal({ a: 2 })

    expect(() => object.$merge({ a: 3 })).to.throw()
    expect(object).to.deep.equal({ a: 2, b: 3 })
    expect(object.$diff).to.deep.equal({ a: 2 })
  })
})
