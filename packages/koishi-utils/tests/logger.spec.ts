import { install, InstalledClock } from '@sinonjs/fake-timers'
import { expect } from 'chai'
import { Logger } from 'koishi-utils'
import { Writable } from 'stream'

describe('Logger API', () => {
  let logger: Logger
  let data: string
  let clock: InstalledClock
  const { colors } = Logger.options

  before(() => {
    Logger.options.colors = false
    clock = install({ now: Date.now() })
  })

  after(() => {
    Logger.options.colors = colors
    clock.uninstall()
  })

  it('basic support', () => {
    logger = new Logger('test').extend('logger', true)
    expect(logger.name).to.equal('test:logger')
    logger.stream = new Writable({
      write(chunk, encoding, callback) {
        data = chunk.toString()
        callback()
      },
    })
  })

  it('format error', () => {
    const error = new Error('message')
    error.stack = null
    logger.error(error)
    expect(data).to.equal('[E] test:logger message\n')
  })

  it('format object', () => {
    clock.tick(2)
    const object = { foo: 'bar' }
    logger.success(object)
    expect(data).to.equal("[S] test:logger { foo: 'bar' } +2ms\n")
  })

  it('custom formatter', () => {
    clock.tick(1)
    Logger.formatters.x = () => 'custom'
    Logger.levels[logger.name] = 2
    logger.info('%x%%x')
    expect(data).to.equal('[I] test:logger custom%x +1ms\n')
  })
})
