import { App, onStart, onStop, startAll, stopAll } from '../src'

const app1 = new App()
const app2 = new App()

describe('lifecycle', () => {
  test('onStart', async () => {
    const mock = jest.fn()
    onStart(mock)
    await startAll()
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(app1, app2)
  })

  test('onStop', async () => {
    const mock = jest.fn()
    onStop(mock)
    await stopAll()
    expect(mock).toBeCalledTimes(1)
  })
})
