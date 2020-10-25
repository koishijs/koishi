import { App, User, Group } from 'koishi-core'
import { BASE_SELF_ID } from './app'
import { expect } from 'chai'
import '../chai'

export function createArray<T>(length: number, create: (index: number) => T) {
  return Array(length).fill(undefined).map((_, index) => create(index))
}

type TestHook = (app: App) => any

export interface TestDatabaseOptions {
  beforeEachUser?: TestHook
  afterEachUser?: TestHook
  beforeEachGroup?: TestHook
  afterEachGroup?: TestHook
}

export function testDatabase(app: App, options: TestDatabaseOptions) {
  const { database: db } = app

  function registerLifecycle(lifecycle: Mocha.HookFunction, hook: TestHook) {
    if (hook) lifecycle(() => hook(app))
  }

  before(function () { return app.start() })
  after(function () { return app.stop() })

  describe('User Operations', function () {
    registerLifecycle(beforeEach, options.beforeEachUser)
    registerLifecycle(afterEach, options.afterEachUser)

    it('getUser with authority -1', async function () {
      const id = 1
      const user = await db.getUser(id, -1)
      expect(user).not.to.be.ok
    })

    it('getUser with authority 0', async function () {
      const id = 2
      const user = await db.getUser(id)
      expect(user).to.have.shape(User.create(id, 0))
    })

    it('getUser with authority 1', async function () {
      const id = 3
      const user = await db.getUser(id, 1)
      expect(user).to.have.shape(User.create(id, 1))
    })

    it('setUser with data', async function () {
      const id = 4, flag = 8
      await db.getUser(id, 1)
      await db.setUser(id, { flag })
      const user = await db.getUser(id)
      expect(user.id).to.equal(id)
      expect(user.flag).to.equal(flag)
    })

    it('setUser without data', async function () {
      const id = 4
      await db.getUser(id, 1)
      await expect(db.setUser(id, {})).to.be.fulfilled
      const user = await db.getUser(id)
      expect(user.id).to.equal(id)
    })

    it('getUserCount', async function () {
      const length = 100
      await Promise.all(createArray(length, i => db.getUser(i, i % 4)))
    })

    it('getUsers without arguments', async function () {
      const length = 100
      await Promise.all(createArray(length, i => db.getUser(i, i % 4)))
      const users = await db.getUsers()
      expect(users.length).to.equal(length * 3 / 4)
    })

    it('getUsers with fields', async function () {
      const length = 100
      await Promise.all(createArray(length, i => db.getUser(i, i % 4)))
      const users = await db.getUsers(['id'])
      expect(users.length).to.equal(length * 3 / 4)
    })

    it('getUsers with ids', async function () {
      const length = 50
      await Promise.all(createArray(length, i => db.getUser(i, i % 4)))
      await expect(db.getUsers([0], ['id'])).eventually.to.have.length(0)
      await expect(db.getUsers([1], ['id'])).eventually.to.have.length(1)
      await expect(db.getUsers([48], ['id'])).eventually.to.have.length(0)
      await expect(db.getUsers([49], ['id'])).eventually.to.have.length(1)
      await expect(db.getUsers([1, 2, 3, 4])).eventually.to.have.length(3)
      await expect(db.getUsers([])).eventually.to.have.length(0)
    })
  })

  describe('Group Operations', function () {
    registerLifecycle(beforeEach, options.beforeEachGroup)
    registerLifecycle(afterEach, options.afterEachGroup)

    it('getGroup with assignee', async function () {
      const id = 123
      const selfId = 456
      const group = await db.getGroup(id, selfId)
      expect(group).to.have.shape(Group.create(id, selfId))
    })

    it('getGroup with fields', async function () {
      const id = 123
      const group = await db.getGroup(id, ['assignee'])
      expect(group.id).to.equal(id)
      expect(group.assignee).to.equal(0)
    })

    it('setGroup with data', async function () {
      const id = 123
      const flag = 789
      await db.getGroup(id, 1)
      await db.setGroup(id, { flag })
      const group = await db.getGroup(id)
      expect(group.id).to.equal(id)
      expect(group.flag).to.equal(flag)
    })

    it('setGroup without data', async function () {
      const id = 123
      await db.getGroup(id, 1)
      await expect(db.setGroup(id, {})).to.be.fulfilled
      const group = await db.getGroup(id)
      expect(group.id).to.equal(id)
    })

    it('getGroupCount', async function () {
      const length = 200
      await Promise.all(createArray(length, i => db.getGroup(i, i)))
    })

    it('getAllGroups with assignees', async function () {
      await Promise.all(createArray(300, i => db.getGroup(i, i % 3)))
      await expect(db.getAllGroups([0])).eventually.to.have.length(0)
      await expect(db.getAllGroups([1])).eventually.to.have.length(100)
      await expect(db.getAllGroups([1, 2])).eventually.to.have.length(200)
    })

    it('getAllGroups with fields', async function () {
      await Promise.all(createArray(300, i => db.getGroup(i, BASE_SELF_ID + i % 3)))
      await expect(db.getAllGroups(['id'])).eventually.to.have.length(100)
      await expect(db.getAllGroups(['id'], [BASE_SELF_ID + 1])).eventually.to.have.length(100)
      await expect(db.getAllGroups(['id'], [])).eventually.to.have.length(0)
    })
  })

  return app
}
