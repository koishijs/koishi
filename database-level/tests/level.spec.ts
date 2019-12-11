import { App } from 'koishi-core'
import { resolve } from 'path'
import '../src'

const app = new App({
  database: {
    level: { path: resolve(__dirname, '../temp') },
  },
})

describe('user', () => {
  afterEach(async () => {
    // @ts-ignore
    await app.database.level.subs.userDB.clear()
  })

  test('getUser unknown user', async () => {
    const userId = 123
    const user = await app.database.getUser(userId)
    expect(userId).toBe(user.id)
  })

  test('setUser', async () => {
    const id = 233
    const flag = 8
    await app.database.setUser(id, { flag })
    const user = await app.database.getUser(id)
    expect(flag).toBe(user.flag)
  })

  test('getAllUsers', async () => {
    const num = 451
    await Promise.all(Array(num).fill(undefined).map((_, i) => app.database.getUser(i + 1, 1)))
    const users = await app.database.getAllUsers()
    expect(num).toBe(users.length)
    expect(typeof users[num - 1].id).toBe('number')
  })

  test('getUsers', async () => {
    const sum = (nums: number[]) => nums.reduce((a, b) => a + b)
    const num = 233
    const ids = [12, 21, 100, 200]
    const idsSum = sum(ids)

    await Promise.all(Array(num).fill(undefined).map((_, i) => app.database.getUser(i + 1, 1)))
    const users = await app.database.getUsers(ids)
    const userIdsSum = sum(users.map(({ id }) => id))

    expect(idsSum).toBe(userIdsSum)
  })

  test('observeUser diff update', async () => {
    const id = 2
    const flag = 823

    const observableUser = await app.database.observeUser(id)
    observableUser.flag = 823
    await observableUser._update()

    const user = await app.database.getUser(id)
    expect(flag).toBe(user.flag)
  })

  test('getUserCount', async () => {
    const num = 321
    await Promise.all(Array(num).fill(undefined).map((_, i) => app.database.getUser(i + 1, 1)))
    const count = await app.database.getUserCount()
    expect(num).toBe(count)
  })
})

describe('group', () => {
  afterEach(async () => {
    // @ts-ignore
    await app.database.level.subs.groupDB.clear()
  })

  test('getGroup unknow group', async () => {
    const groupId = 123
    const group = await app.database.getGroup(groupId)
    expect(groupId).toBe(group.id)
  })

  test('setGroup', async () => {
    const groupId = 123
    const flag = 238
    await app.database.setGroup(groupId, { flag })
    const group = await app.database.getGroup(groupId)
    expect(flag).toBe(group.flag)
  })

  test('getAllGroups', async () => {
    const num = 233
    await Promise.all(Array(num).fill(undefined).map((_, i) => app.database.getGroup(i + 1, 1)))
    const groups = await app.database.getAllGroups(undefined, [1])
    expect(num).toBe(groups.length)
    expect(typeof groups[num - 1].id).toBe('number')
  })

  test('observeGroup diff update', async () => {
    const id = 2
    const flag = 823

    const observableGroup = await app.database.observeGroup(id)
    observableGroup.flag = 823
    await observableGroup._update()

    const group = await app.database.getGroup(id)
    expect(flag).toBe(group.flag)
  })

  test('getGroupCount', async () => {
    const num = 133
    await Promise.all(Array(num).fill(undefined).map((_, i) => app.database.getGroup(i + 1, 1)))
    const count = await app.database.getGroupCount()
    expect(num).toBe(count)
  })
})
