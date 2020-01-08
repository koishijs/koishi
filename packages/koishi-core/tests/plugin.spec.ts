import { App, errors } from 'koishi-core'
import { noop } from 'koishi-utils'

const app = new App()

describe('Plugin API', () => {
  test('call chaining', () => {
    expect(app.plugin(noop)).toBe(app)

    const ctx = app.users.except(123).plus(app.group(456))
    expect(ctx.plugin(noop)).toBe(ctx)
  })

  test('apply functional plugin', () => {
    const callback = jest.fn()
    const options = { foo: 'bar' }
    app.plugin(callback, options)

    expect(callback).toBeCalledTimes(1)
    expect(callback).not.toBeCalledWith(options)
    expect(callback.mock.calls[0][1]).toMatchObject(options)
  })

  test('apply object plugin', () => {
    const callback = jest.fn()
    const options = { bar: 'foo' }
    const plugin = { apply: callback }
    app.plugin(plugin, options)

    expect(callback).toBeCalledTimes(1)
    expect(callback).not.toBeCalledWith(options)
    expect(callback.mock.calls[0][1]).toMatchObject(options)
  })

  test('apply functional plugin with false', () => {
    const callback = jest.fn()
    app.plugin(callback, false)

    expect(callback).toBeCalledTimes(0)
  })

  test('apply object plugin with false', () => {
    const callback = jest.fn()
    const plugin = { apply: callback }
    app.plugin(plugin, false)

    expect(callback).toBeCalledTimes(0)
  })

  test('apply invalid plugin', () => {
    expect(() => app.plugin(undefined)).toThrowError(errors.INVALID_PLUGIN)
    expect(() => app.plugin({} as any)).toThrowError(errors.INVALID_PLUGIN)
    expect(() => app.plugin({ apply: {} } as any)).toThrowError(errors.INVALID_PLUGIN)
  })
})
