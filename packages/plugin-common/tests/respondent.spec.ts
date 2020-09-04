import { MockedApp } from 'koishi-test-utils'
import { respondent } from '../src'

const app = new MockedApp()
const session = app.session(123)

// make coverage happy
app.plugin(respondent)
app.plugin(respondent, [{
  match: '挖坑一时爽',
  reply: '填坑火葬场',
}, {
  match: /^(.+)一时爽$/,
  reply: (_, action) => `一直${action}一直爽`,
}])

it('basic support', async () => {
  await session.shouldReply('挖坑一时爽', '填坑火葬场')
  await session.shouldReply('填坑一时爽', '一直填坑一直爽')
  await session.shouldNotReply('填坑一直爽')
})
