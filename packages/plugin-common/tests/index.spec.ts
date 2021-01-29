import { MockedApp } from 'koishi-test-utils'
import * as common from '../src'
import 'koishi-database-memory'
import { expect } from 'chai'

it('basic support', () => {
  const app = new MockedApp()
  app.plugin(common)

  expect(app._commandMap.admin).not.to.be.ok
  expect(app._commandMap.broadcast).not.to.be.ok
  expect(app._commandMap.echo).to.be.ok
  expect(app._commandMap.exec).to.be.ok
  expect(app._commandMap.exit).to.be.ok
  expect(app._commandMap.contextify).not.to.be.ok
  expect(app._commandMap.help).to.be.ok
  expect(app._commandMap.info).not.to.be.ok
})

it('skip database commands', () => {
  const app = new MockedApp({ database: { memory: {} } })
  app.plugin(common)

  expect(app._commandMap.admin).to.be.ok
  expect(app._commandMap.broadcast).to.be.ok
  expect(app._commandMap.echo).to.be.ok
  expect(app._commandMap.exec).to.be.ok
  expect(app._commandMap.exit).to.be.ok
  expect(app._commandMap.contextify).to.be.ok
  expect(app._commandMap.help).to.be.ok
  expect(app._commandMap.info).to.be.ok
})

test('disable commands', () => {
  const app = new MockedApp({ database: { memory: {} } })

  app.plugin(common, {
    admin: false,
    broadcast: false,
    contextify: false,
    echo: false,
    exec: false,
    exit: false,
    help: false,
    info: false,
  })

  expect(app._commandMap.admin).not.to.be.ok
  expect(app._commandMap.broadcast).not.to.be.ok
  expect(app._commandMap.echo).not.to.be.ok
  expect(app._commandMap.exec).not.to.be.ok
  expect(app._commandMap.exit).not.to.be.ok
  expect(app._commandMap.contextify).not.to.be.ok
  expect(app._commandMap.help).not.to.be.ok
  expect(app._commandMap.info).not.to.be.ok
})
