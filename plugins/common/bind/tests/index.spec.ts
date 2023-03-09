import { Context } from 'koishi'
import * as bind from '@koishijs/plugin-bind'
import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'

const app = new Context()

let counter = 0

app.plugin(bind, {
  generateToken: () => `koishi/${(++counter).toString().padStart(6, '0')}`,
})

app.plugin(mock)
app.plugin(memory)

app.command('name').userFields(['name']).action(({ session }) => session!.username)

const client1 = app.mock.client('123', '321')
const client2 = app.mock.client('456', '654')

before(async () => {
  await app.start()
  await app.mock.initUser('123', 1, { name: 'foo' })
  await app.mock.initUser('456', 1, { name: 'bar' })
})

after(() => app.stop())

describe('@koishijs/plugin-bind', () => {
  it('should bind successfully', async () => {
    await client1.shouldReply('name', 'foo')
    await client2.shouldReply('name', 'bar')
    await client1.shouldReply('bind', /^koishi\/000001$/m)
    await client2.shouldReply('koishi/000001', /^koishi\/000002$/m)
    await client1.shouldReply('koishi/000002', '账号绑定成功！')
    await client1.shouldReply('name', 'bar')
    await client2.shouldReply('name', 'bar')
  })
})
