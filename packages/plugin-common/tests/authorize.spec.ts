import { App } from 'koishi-test-utils'
import { sleep } from 'koishi-utils'
import { createUser } from 'koishi-core'
import { authorize, AuthorizeOptions } from '../src'
import 'koishi-database-memory'

let counter = 0

function createApp () {
  return new App({ database: { memory: { identifier: ++counter } } })
}

test('authorize user', async () => {
  const app = createApp()

  // make coverage happy
  app.plugin(authorize)
  app.plugin<AuthorizeOptions>(authorize, {
    authorizeUser: {
      123: 2,
      231: 2,
      312: 2,
    },
  })

  app.receiver.on('connect', () => {
    app.database.memory.store.user[231] = createUser(231, 3)
    app.database.memory.store.user[312] = createUser(312, 1)
  })

  await app.start()
  await sleep(0)

  await expect(app.database.getUser(123)).resolves.toHaveProperty('authority', 2)
  await expect(app.database.getUser(231)).resolves.toHaveProperty('authority', 3)
  await expect(app.database.getUser(312)).resolves.toHaveProperty('authority', 2)
})

test('authorize group 1', async () => {
  const app = createApp()

  app.plugin<AuthorizeOptions>(authorize, {
    authorizeGroup: {
      456: 2,
    },
  })

  app.receiver.on('connect', () => {
    app.database.memory.store.user[231] = createUser(231, 3)
    app.database.memory.store.user[312] = createUser(312, 1)
  })

  app.setResponse('get_group_member_list', [
    { userId: 123, role: 'member' },
    { userId: 231, role: 'member' },
    { userId: 312, role: 'member' },
  ])

  await app.start()
  await sleep(0)

  await expect(app.database.getGroup(456)).resolves.toHaveProperty('assignee', app.selfId)
  await expect(app.database.getUser(123)).resolves.toHaveProperty('authority', 2)
  await expect(app.database.getUser(231)).resolves.toHaveProperty('authority', 3)
  await expect(app.database.getUser(312)).resolves.toHaveProperty('authority', 2)
})

test('authorize group 2', async () => {
  const app = createApp()

  app.plugin<AuthorizeOptions>(authorize, {
    authorizeGroup: {
      456: { admin: 2, owner: 3 },
    },
  })

  app.setResponse('get_group_member_list', [
    { userId: 123, role: 'member' },
    { userId: 231, role: 'admin' },
    { userId: 312, role: 'owner' },
  ])

  await app.start()
  await sleep(0)

  await expect(app.database.getGroup(456)).resolves.toHaveProperty('assignee', app.selfId)
  await expect(app.database.getUser(123)).resolves.toHaveProperty('authority', 1)
  await expect(app.database.getUser(231)).resolves.toHaveProperty('authority', 2)
  await expect(app.database.getUser(312)).resolves.toHaveProperty('authority', 3)
})

describe('handle group increase', () => {
  const app = createApp()

  app.plugin<AuthorizeOptions>(authorize, {
    authorizeGroup: {
      456: 2,
    },
  })

  app.receiver.on('connect', () => {
    app.database.memory.store.user[231] = createUser(231, 3)
    app.database.memory.store.user[312] = createUser(312, 1)
  })

  app.setResponse('get_group_member_list', [])

  beforeAll(async () => {
    await app.start()
    await sleep(0)
  })

  test('create new user', async () => {
    app.receiveGroupIncrease('approve', 123, 456)
    await sleep(0)
    await expect(app.database.getUser(123)).resolves.toHaveProperty('authority', 2)
  })

  test('not affect higher authority', async () => {
    app.receiveGroupIncrease('approve', 231, 456)
    await sleep(0)
    await expect(app.database.getUser(231)).resolves.toHaveProperty('authority', 3)
  })

  test('overwrite lower authority', async () => {
    app.receiveGroupIncrease('approve', 312, 456)
    await sleep(0)
    await expect(app.database.getUser(312)).resolves.toHaveProperty('authority', 2)
  })

  test('skip unregistered groups', async () => {
    app.receiveGroupIncrease('approve', 789, 789)
    await sleep(0)
    await expect(app.database.getUser(789)).resolves.toHaveProperty('authority', 0)
  })
})

describe('handle group admin set', () => {
  const app = createApp()

  app.plugin<AuthorizeOptions>(authorize, {
    authorizeGroup: {
      456: { admin: 2 },
    },
  })

  app.receiver.on('connect', () => {
    app.database.memory.store.user[231] = createUser(231, 3)
    app.database.memory.store.user[312] = createUser(312, 1)
  })

  app.setResponse('get_group_member_list', [
    { userId: 123, role: 'member' },
    { userId: 231, role: 'member' },
  ])

  beforeAll(async () => {
    await app.start()
    await sleep(0)
  })

  test('not affect higher authority', async () => {
    app.receiveGroupAdmin('set', 231, 456)
    await sleep(0)
    await expect(app.database.getUser(231)).resolves.toHaveProperty('authority', 3)
  })

  test('overwrite lower authority', async () => {
    app.receiveGroupAdmin('set', 123, 456)
    await sleep(0)
    await expect(app.database.getUser(123)).resolves.toHaveProperty('authority', 2)
  })

  test('skip unregistered groups', async () => {
    app.receiveGroupAdmin('set', 312, 789)
    await sleep(0)
    await expect(app.database.getUser(312)).resolves.toHaveProperty('authority', 1)
  })
})

test('mixed usage', async () => {
  const app = createApp()

  app.plugin<AuthorizeOptions>(authorize, {
    authorizeUser: {
      123: 2,
    },
    authorizeGroup: {
      456: 1,
      564: 3,
    },
  })

  app.receiver.on('connect', () => {
    app.database.memory.store.user[231] = createUser(231, 2)
    app.database.memory.store.user[312] = createUser(312, 1)
  })

  app.setResponse('get_group_member_list', [
    { userId: 123, role: 'member' },
    { userId: 231, role: 'member' },
    { userId: 312, role: 'member' },
  ])

  await app.start()
  await sleep(0)

  await expect(app.database.getUser(123)).resolves.toHaveProperty('authority', 3)
  await expect(app.database.getUser(231)).resolves.toHaveProperty('authority', 3)
  await expect(app.database.getUser(312)).resolves.toHaveProperty('authority', 3)
})
