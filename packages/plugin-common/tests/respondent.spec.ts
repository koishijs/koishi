import { MockedApp } from 'koishi-test-utils'
import respondent, { Respondent } from '../src/respondent'

const app = new MockedApp()
const session = app.createSession('user', 123)

// make coverage happy
app.plugin(respondent)
app.plugin<Respondent[]>(respondent, [{
  match: '挖坑一时爽',
  reply: '填坑火葬场',
}, {
  match: /^(.+)一时爽$/,
  reply: (_, action) => `一直${action}一直爽`,
}])

test('basic support', async () => {
  await session.shouldHaveReply('挖坑一时爽', '填坑火葬场')
  await session.shouldHaveReply('填坑一时爽', '一直填坑一直爽')
  await session.shouldHaveNoResponse('填坑一直爽')
})
