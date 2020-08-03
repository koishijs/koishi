import { observe, noop } from '../src'

describe('Observer API', () => {
  test('type checks', () => {
    expect(() => observe(1 as never)).toThrow()
    expect(() => observe('2' as never)).toThrow()
    expect(() => observe(/./ as never)).toThrow()
    expect(() => observe(BigInt(3) as never)).toThrow()
    expect(() => observe(true as never)).toThrow()
    expect(() => observe(noop as never)).toThrow()
    expect(() => observe(Symbol('foo') as never)).toThrow()
    expect(() => observe(Symbol.for('foo') as never)).toThrow()
    expect(() => observe(null as never)).toThrow()
    expect(() => observe(undefined as never)).toThrow()
    expect(() => observe(new Array() as never)).toThrow()
    expect(() => observe(new Date() as never)).toThrow()
    expect(() => observe(new Set() as never)).toThrow()
    expect(() => observe(new Map() as never)).toThrow()
    expect(() => observe(new WeakSet() as never)).toThrow()
    expect(() => observe(new WeakMap() as never)).toThrow()
  })

  test('observe property', () => {
    const target: Record<string, number> = { a: 1, b: 2 }
    const object = observe(target)
    expect(object._diff).toMatchObject({})

    object.a = 1
    expect(object).toMatchObject({ a: 1, b: 2 })
    expect(object._diff).toMatchObject({})

    object.a = 2
    expect(object).toMatchObject({ a: 2, b: 2 })
    expect(object._diff).toMatchObject({ a: 2 })

    object.c = 3
    expect(object).toMatchObject({ a: 2, b: 2, c: 3 })
    expect(object._diff).toMatchObject({ a: 2, c: 3 })

    delete object.b
    expect(object).toMatchObject({ a: 2, c: 3 })
    expect(object._diff).toMatchObject({ a: 2, c: 3 })

    delete object.c
    expect(object).toMatchObject({ a: 2 })
    expect(object._diff).toMatchObject({ a: 2 })
  })

  test('deep observe', () => {
    const object = observe<any>({ a: { b: 1 }, c: [{ d: 2 }], x: [{ y: 3 }] })
    expect(object._diff).toMatchObject({})

    object.a.e = 3
    expect(object).toMatchObject({ a: { b: 1, e: 3 }, c: [{ d: 2 }], x: [{ y: 3 }] })
    expect(object._diff).toMatchObject({ a: { b: 1, e: 3 } })

    object.c.push({ f: 4 })
    expect(object).toMatchObject({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 3 }] })
    expect(object._diff).toMatchObject({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }] })

    object.x[0].y = 4
    expect(object).toMatchObject({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }] })
    expect(object._diff).toMatchObject({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }] })

    object.x[1] = [5]
    expect(object).toMatchObject({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }, [5]] })
    expect(object._diff).toMatchObject({ a: { b: 1, e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }, [5]] })

    delete object.a.b
    expect(object).toMatchObject({ a: { e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }, [5]] })
    expect(object._diff).toMatchObject({ a: { e: 3 }, c: [{ d: 2 }, { f: 4 }], x: [{ y: 4 }, [5]] })
  })

  test('flush changes', () => {
    const flush = jest.fn()
    const object = observe({ a: 1, b: [2] }, flush)
    expect(object._diff).toMatchObject({})

    object._update()
    expect(flush).toBeCalledTimes(0)

    object.b.shift()
    expect(object).toMatchObject({ a: 1, b: [] })
    expect(object._diff).toMatchObject({ b: [] })

    object._update()
    expect(flush).toBeCalledTimes(1)
    expect(flush).toBeCalledWith({ b: [] })
    expect(object).toMatchObject({ a: 1, b: [] })
    expect(object._diff).toMatchObject({})

    object.a = 3
    expect(object).toMatchObject({ a: 3, b: [] })
    expect(object._diff).toMatchObject({ a: 3 })

    object._update()
    expect(flush).toBeCalledTimes(2)
    expect(flush).toBeCalledWith({ a: 3 })
    expect(object).toMatchObject({ a: 3, b: [] })
    expect(object._diff).toMatchObject({})
  })

  test('merge properties', () => {
    const object = observe<any>({ a: 1 })
    expect(object._diff).toMatchObject({})

    object.a = 2
    expect(object).toMatchObject({ a: 2 })
    expect(object._diff).toMatchObject({ a: 2 })

    object._merge({ b: 3 })
    expect(object).toMatchObject({ a: 2, b: 3 })
    expect(object._diff).toMatchObject({ a: 2 })

    expect(() => object._merge({ a: 3 })).toThrow()
    expect(object).toMatchObject({ a: 2, b: 3 })
    expect(object._diff).toMatchObject({ a: 2 })
  })
})
