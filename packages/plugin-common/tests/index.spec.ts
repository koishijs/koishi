import { MockedApp } from 'koishi-test-utils'
import * as common from '../src'
import 'koishi-database-memory'

test('basic support', () => {
  const app = new MockedApp()
  app.plugin<common.CommonPluginConfig>(common)

  expect(app._commandMap.admin).toBeFalsy()
  expect(app._commandMap.broadcast).toBeFalsy()
  expect(app._commandMap.echo).toBeTruthy()
  expect(app._commandMap.exec).toBeTruthy()
  expect(app._commandMap.exit).toBeTruthy()
  expect(app._commandMap.contextify).toBeFalsy()
  expect(app._commandMap.help).toBeTruthy()
  expect(app._commandMap.info).toBeFalsy()
})

test('skip database commands', () => {
  const app = new MockedApp({ database: { memory: {} } })
  app.plugin<common.CommonPluginConfig>(common)

  expect(app._commandMap.admin).toBeTruthy()
  expect(app._commandMap.broadcast).toBeTruthy()
  expect(app._commandMap.echo).toBeTruthy()
  expect(app._commandMap.exec).toBeTruthy()
  expect(app._commandMap.exit).toBeTruthy()
  expect(app._commandMap.contextify).toBeTruthy()
  expect(app._commandMap.help).toBeTruthy()
  expect(app._commandMap.info).toBeTruthy()
})

test('disable commands', () => {
  const app = new MockedApp({ database: { memory: {} } })

  app.plugin<common.CommonPluginConfig>(common, {
    admin: false,
    broadcast: false,
    contextify: false,
    echo: false,
    exec: false,
    exit: false,
    help: false,
    info: false,
  })

  expect(app._commandMap.admin).toBeFalsy()
  expect(app._commandMap.broadcast).toBeFalsy()
  expect(app._commandMap.echo).toBeFalsy()
  expect(app._commandMap.exec).toBeFalsy()
  expect(app._commandMap.exit).toBeFalsy()
  expect(app._commandMap.contextify).toBeFalsy()
  expect(app._commandMap.help).toBeFalsy()
  expect(app._commandMap.info).toBeFalsy()
})
