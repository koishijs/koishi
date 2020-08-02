import { App, createUser, createGroup } from 'koishi-core'
import { BASE_SELF_ID } from './app'

export function createArray <T> (length: number, create: (index: number) => T) {
  return Array(length).fill(undefined).map((_, index) => create(index))
}

type TestHook = (app: App) => any

export interface TestDatabaseOptions {
  beforeEachUser?: TestHook
  afterEachUser?: TestHook
  beforeEachGroup?: TestHook
  afterEachGroup?: TestHook
}

export function testDatabase (app: App, options: TestDatabaseOptions) {
  const { database: db } = app

  function registerLifecycle (lifecycle: jest.Lifecycle, hook: TestHook) {
    if (hook) lifecycle(() => hook(app))
  }

  beforeAll(() => app.start())
  afterAll(() => app.stop())

  describe('user operations', () => {
    registerLifecycle(beforeEach, options.beforeEachUser)
    registerLifecycle(afterEach, options.afterEachUser)

    test('getUser with authority -1', async () => {
      const id = 1
      const user = await db.getUser(id, -1)
      expect(user).toBeFalsy()
      // const count = await db.getUserCount()
      // expect(count).toBe(0)
    })

    test('getUser with authority 0', async () => {
      const id = 2
      const user = await db.getUser(id)
      expect(user).toMatchObject(createUser(id, 0))
    })

    test('getUser with authority 1', async () => {
      const id = 3
      const user = await db.getUser(id, 1)
      expect(user).toMatchObject(createUser(id, 1))
    })

    test('setUser with data', async () => {
      const id = 4, flag = 8
      await db.getUser(id, 1)
      await db.setUser(id, { flag })
      const user = await db.getUser(id)
      expect(user.id).toBe(id)
      expect(user.flag).toBe(flag)
    })

    test('setUser without data', async () => {
      const id = 4
      await db.getUser(id, 1)
      await expect(db.setUser(id, {})).resolves.not.toThrow()
      const user = await db.getUser(id)
      expect(user.id).toBe(id)
    })

    test('getUserCount', async () => {
      const length = 100
      await Promise.all(createArray(length, i => db.getUser(i, i % 4)))
    })

    test('getUsers without arguments', async () => {
      const length = 100
      await Promise.all(createArray(length, i => db.getUser(i, i % 4)))
      const users = await db.getUsers()
      expect(users.length).toBe(length * 3 / 4)
    })

    test('getUsers with fields', async () => {
      const length = 100
      await Promise.all(createArray(length, i => db.getUser(i, i % 4)))
      const users = await db.getUsers(['id'])
      expect(users.length).toBe(length * 3 / 4)
    })

    test('getUsers with ids', async () => {
      const length = 50
      await Promise.all(createArray(length, i => db.getUser(i, i % 4)))
      await expect(db.getUsers([0], ['id'])).resolves.toHaveLength(0)
      await expect(db.getUsers([1], ['id'])).resolves.toHaveLength(1)
      await expect(db.getUsers([48], ['id'])).resolves.toHaveLength(0)
      await expect(db.getUsers([49], ['id'])).resolves.toHaveLength(1)
      await expect(db.getUsers([1, 2, 3, 4])).resolves.toHaveLength(3)
      await expect(db.getUsers([])).resolves.toHaveLength(0)
    })
  })

  describe('group operations', () => {
    registerLifecycle(beforeEach, options.beforeEachGroup)
    registerLifecycle(afterEach, options.afterEachGroup)

    test('getGroup with assignee', async () => {
      const id = 123
      const selfId = 456
      const group = await db.getGroup(id, selfId)
      expect(group).toMatchObject(createGroup(id, selfId))
    })

    test('getGroup with fields', async () => {
      const id = 123
      const group = await db.getGroup(id, ['assignee'])
      expect(group.id).toBe(id)
      expect(group.assignee).toBe(0)
    })

    test('setGroup with data', async () => {
      const id = 123
      const flag = 789
      await db.getGroup(id, 1)
      await db.setGroup(id, { flag })
      const group = await db.getGroup(id)
      expect(group.id).toBe(id)
      expect(group.flag).toBe(flag)
    })

    test('setGroup without data', async () => {
      const id = 123
      await db.getGroup(id, 1)
      await expect(db.setGroup(id, {})).resolves.not.toThrow()
      const group = await db.getGroup(id)
      expect(group.id).toBe(id)
    })

    test('getGroupCount', async () => {
      const length = 200
      await Promise.all(createArray(length, i => db.getGroup(i, i)))
    })

    test('getAllGroups with assignees', async () => {
      await Promise.all(createArray(300, i => db.getGroup(i, i % 3)))
      await expect(db.getAllGroups([0])).resolves.toHaveLength(0)
      await expect(db.getAllGroups([1])).resolves.toHaveLength(100)
      await expect(db.getAllGroups([1, 2])).resolves.toHaveLength(200)
    })

    test('getAllGroups with fields', async () => {
      await Promise.all(createArray(300, i => db.getGroup(i, BASE_SELF_ID + i % 3)))
      await expect(db.getAllGroups(['id'])).resolves.toHaveLength(100)
      await expect(db.getAllGroups(['id'], [BASE_SELF_ID + 1])).resolves.toHaveLength(100)
      await expect(db.getAllGroups(['id'], [])).resolves.toHaveLength(0)
    })
  })

  return app
}
