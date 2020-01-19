import { MockedApp } from 'koishi-test-utils'
import authorize, { AuthorizeOptions } from '../src/authorize'
import 'koishi-database-memory'
import { sleep } from 'koishi-utils'
import { createUser, MetaTypeMap, SubTypeMap, Meta } from 'koishi-core'

const app = new MockedApp({ database: { memory: {} } })

// make coverage happy
app.plugin(authorize)
app.plugin<AuthorizeOptions>(authorize, {
  authorizeUser: {
    123: 2,
    231: 2,
    312: 2,
  },
  authorizeGroup: {
    123: 1,
    231: {
      admin: 2,
      owner: 3,
    },
    312: 3,
  },
})

// mock group
app.setResponse('get_group_member_list', (params) => {
  let data = []
  if (params.group_id === 123) {
    data = [
      { user_id: 564, role: 'member' },
    ]
  } else if (params.group_id === 231) {
    data = [
      { user_id: 123, role: 'member' },
      { user_id: 564, role: 'admin' },
      { user_id: 645, role: 'owner' },
    ]
  }
  return { data }
})

app.receiver.on('connect', () => {
  app.database.memory.store.user[231] = createUser(231, 3)
  app.database.memory.store.user[312] = createUser(312, 2)
})

beforeAll(async () => {
  await app.start()
  await sleep(0)
})

test('basic support', async () => {
  await expect(app.database.getUser(123)).resolves.toHaveProperty('authority', 2)
  await expect(app.database.getUser(231)).resolves.toHaveProperty('authority', 2)
  await expect(app.database.getUser(312)).resolves.toHaveProperty('authority', 2)
  await expect(app.database.getGroup(123)).resolves.toHaveProperty('assignee', app.selfId)
  await expect(app.database.getGroup(231)).resolves.toHaveProperty('assignee', app.selfId)
  await expect(app.database.getGroup(312)).resolves.toHaveProperty('assignee', app.selfId)
  await expect(app.database.getUser(564)).resolves.toHaveProperty('authority', 2)
  await expect(app.database.getUser(645)).resolves.toHaveProperty('authority', 3)
})

const createGroupIncrease = (userId: number, groupId: number): Meta => ({
  postType: 'notice',
  noticeType: 'group_increase',
  subType: 'invite',
  userId,
  groupId,
})

describe('handle group_increase', () => {
  test('create new user', async () => {
    app.receive(createGroupIncrease(456, 231))
    await sleep(0)
    await expect(app.database.getUser(456)).resolves.toHaveProperty('authority', 1)
  })

  test('not affect higher authority', async () => {
    app.receive(createGroupIncrease(312, 231))
    await sleep(0)
    await expect(app.database.getUser(312)).resolves.toHaveProperty('authority', 2)
  })

  test('overwrite lower authority', async () => {
    app.receive(createGroupIncrease(564, 312))
    await sleep(0)
    await expect(app.database.getUser(564)).resolves.toHaveProperty('authority', 3)
  })

  test('skip unregistered groups', async () => {
    app.receive(createGroupIncrease(789, 789))
    await sleep(0)
    await expect(app.database.getUser(789)).resolves.toHaveProperty('authority', 0)
  })
})

test('handle group-admin/set', async () => {
  app.receive({
    postType: 'notice',
    noticeType: 'group_admin',
    subType: 'set',
    userId: 456,
    groupId: 231,
  })

  await sleep(0)
  await expect(app.database.getUser(456)).resolves.toHaveProperty('authority', 2)
})
