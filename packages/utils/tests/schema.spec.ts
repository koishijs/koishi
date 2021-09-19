import { expect } from 'chai'
import { Schema } from 'koishi'
import '@koishijs/test-utils'

describe('Schema API', () => {
  it('trivial cases', () => {
    expect(Schema.validate('foo')).to.equal('foo')
    expect(Schema.validate(123, null)).to.equal(123)
    expect(() => Schema.validate({}, { type: 'x' })).to.throw()
  })

  it('any & never', () => {
    expect(Schema.validate(123, Schema.any())).to.equal(123)
    expect(Schema.validate(null, Schema.any())).to.equal(null)
    expect(Schema.validate(null, Schema.never())).to.equal(null)
    expect(() => Schema.validate(123, Schema.never())).to.throw()
  })

  it('string', () => {
    const schema = Schema.string().default('bar')

    expect(Schema.validate('foo', schema)).to.equal('foo')
    expect(Schema.validate('', schema)).to.equal('')
    expect(Schema.validate(null, schema)).to.equal('bar')
    expect(() => Schema.validate(123, schema)).to.throw()
  })

  it('number', () => {
    const schema = Schema.number().default(123)

    expect(Schema.validate(456, schema)).to.equal(456)
    expect(Schema.validate(0, schema)).to.equal(0)
    expect(Schema.validate(null, schema)).to.equal(123)
    expect(() => Schema.validate('123', schema)).to.throw()
  })

  it('array', () => {
    const schema = Schema.array(Schema.string())

    expect(Schema.validate(['456'], schema)).to.deep.equal(['456'])
    expect(Schema.validate([], schema)).to.deep.equal([])
    expect(Schema.validate(null, schema)).to.deep.equal([])
    expect(() => Schema.validate('', schema)).to.throw()
    expect(() => Schema.validate({}, schema)).to.throw()
    expect(() => Schema.validate([0], schema)).to.throw()
  })

  it('dict', () => {
    const schema = Schema.dict(Schema.number())

    expect(Schema.validate({ a: 1 }, schema)).to.deep.equal({ a: 1 })
    expect(Schema.validate({}, schema)).to.deep.equal({})
    expect(Schema.validate(null, schema)).to.deep.equal({})
    expect(() => Schema.validate(1, schema)).to.throw()
    expect(() => Schema.validate([], schema)).to.throw()
    expect(() => Schema.validate({ a: '' }, schema)).to.throw()
  })

  it('select 1', () => {
    const schema = Schema.select(['foo', 'bar'])

    expect(Schema.validate('bar', schema)).to.equal('bar')
    expect(() => Schema.validate('baz', schema)).to.throw()
  })

  it('select 2', () => {
    const schema = Schema.select({ 1: 'baz', 2: 'bax' })

    expect(Schema.validate('2', schema)).to.equal('2')
    expect(() => Schema.validate(2, schema)).to.throw()
  })

  it('object 1', () => {
    const schema = Schema.object({
      a: Schema.string().required(),
      b: Schema.number().default(123),
    })

    const original = { a: 'foo', c: true }
    expect(Schema.validate(original, schema)).to.deep.equal({ a: 'foo', b: 123 })
    expect(Schema.validate({ a: 'foo', b: 0 }, schema)).to.deep.equal({ a: 'foo', b: 0 })
    expect(() => Schema.validate(null, schema)).to.throw()
    expect(() => Schema.validate({}, schema)).to.throw()
    expect(() => Schema.validate({ a: 0 }, schema)).to.throw()
    expect(() => Schema.validate({ a: '', b: '' }, schema)).to.throw()

    // we resolve value without modifying the original object
    expect(original).to.deep.equal({ a: 'foo', c: true })
  })

  it('object 2', () => {
    const schema = Schema.object({
      a: Schema.string(),
      b: Schema.number(),
    })

    expect(Schema.validate(null, schema)).to.deep.equal({})
    expect(Schema.validate({}, schema)).to.deep.equal({})
    expect(() => Schema.validate([], schema)).to.throw()
    expect(() => Schema.validate('foo', schema)).to.throw()
    expect(() => Schema.validate(123, schema)).to.throw()
  })

  it('decide 1', () => {
    const schema = Schema.decide('a', {
      foo: Schema.object({ b: Schema.number() }),
      bar: Schema.object({ b: Schema.string() }),
    })

    expect(Schema.validate(null, schema)).to.equal(null)
    expect(Schema.validate({ a: 'foo', b: 123 }, schema)).to.deep.equal({ a: 'foo', b: 123 })
    expect(Schema.validate({ a: 'bar', b: 'x' }, schema)).to.deep.equal({ a: 'bar', b: 'x' })
    expect(() => Schema.validate({ b: 123 }, schema)).to.throw()
    expect(() => Schema.validate({ b: 'x' }, schema)).to.throw()
  })

  it('decide 2', () => {
    const schema = Schema.decide('a', {
      foo: Schema.object({ b: Schema.number() }),
      bar: Schema.object({ b: Schema.string() }),
    }, ({ b }) => typeof b === 'number' ? 'foo' : 'bar')

    expect(Schema.validate({ b: 123 }, schema)).to.deep.equal({ a: 'foo', b: 123 })
    expect(Schema.validate({ b: 'x' }, schema)).to.deep.equal({ a: 'bar', b: 'x' })
    expect(() => Schema.validate({ a: 'foo', b: 'x' }, schema)).to.throw()
    expect(() => Schema.validate({ a: 'bar', b: 123 }, schema)).to.throw()
  })

  it('adapt with array', () => {
    const schema = Schema.array(Schema.adapt(
      Schema.string(),
      Schema.number(),
      data => data.toString(),
    ))

    const original = [456, 123]
    expect(Schema.validate(['456'], schema)).to.deep.equal(['456'])
    expect(Schema.validate(original, schema)).to.deep.equal(['456', '123'])
    expect(Schema.validate(null, schema)).to.deep.equal([])
    expect(() => Schema.validate({}, schema)).to.throw()
    expect(() => Schema.validate([{}], schema)).to.throw()

    // modify original data during adaptation
    expect(original).to.deep.equal(['456', '123'])
  })

  it('adapt with object', () => {
    const schema = Schema.object({
      foo: Schema.adapt(
        Schema.array(Schema.number()),
        Schema.number(),
        data => [data],
      ),
    })

    const original = { foo: 0 }
    expect(Schema.validate(null, schema)).to.deep.equal({ foo: [] })
    expect(Schema.validate({}, schema)).to.deep.equal({ foo: [] })
    expect(Schema.validate(original, schema)).to.deep.equal({ foo: [0] })
    expect(Schema.validate({ foo: [1] }, schema)).to.deep.equal({ foo: [1] })
    expect(() => Schema.validate({ foo: '' }, schema)).to.throw()
    expect(() => Schema.validate({ foo: [''] }, schema)).to.throw()

    // modify original data during adaptation
    expect(original).to.deep.equal({ foo: [0] })
  })

  it('adapt with merge', () => {
    const inner = Schema.object({
      a: Schema.number().required(),
      d: Schema.number().default(0),
    })

    const outer = Schema.merge([
      Schema.object({ c: Schema.number() }),
      Schema.adapt(
        Schema.object({
          b: Schema.array(inner).required(),
        }),
        inner,
        data => ({ b: [data] }),
      ),
    ])

    const original = { a: 1, c: 3, e: 5 }
    expect(Schema.validate(original, outer)).to.deep.equal({ b: [{ a: 1, d: 0 }], c: 3 })
    expect(Schema.validate({ b: [{ a: 2, c: 3 }] }, outer)).to.deep.equal({ b: [{ a: 2, d: 0 }] })
    expect(() => Schema.validate({}, outer)).to.throw()
    expect(() => Schema.validate({ a: '' }, outer)).to.throw()
    expect(() => Schema.validate({ b: {} }, outer)).to.throw()
    expect(() => Schema.validate({ b: [{ c: 3 }] }, outer)).to.throw()
    expect(() => Schema.validate({ a: 1, c: 'foo' }, outer)).to.throw()

    // modify original data during adaptation
    expect(original).to.deep.equal({ b: [{ a: 1 }], c: 3, e: 5 })
  })
})
