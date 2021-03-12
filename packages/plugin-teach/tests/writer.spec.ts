import createEnvironment from './environment'
import jest from 'jest-mock'

const DETAIL_HEAD_QES = '编号为 1 的问答信息：\n问题：foo\n'
const DETAIL_HEAD = DETAIL_HEAD_QES + '回答：bar\n'
const SEARCH_HEAD = '问题“foo”的回答如下：\n'

describe('Teach Plugin - Writer', () => {
  const { app, u2g1, u3g1, u4g2 } = createEnvironment({ useWriter: true })

  app.command('test').action(({ session }) => '' + session.userId)

  it('create writer', async () => {
    // 当自身未设置 username 时使用 session.sender
    u3g1.meta.author.username = 'nick3'
    await u3g1.shouldReply('# foo bar', '问答已添加，编号为 1。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '来源：nick3 (300)')

    // 重复添加问答时不应该覆盖旧的作者
    await app.database.setUser('mock', '300', { name: 'user3' })
    await u4g2.shouldReply('# foo bar', '问答已存在，编号为 1，如要修改请尝试使用 #1 指令。')
    await u4g2.shouldReply('#1', DETAIL_HEAD + '来源：user3 (300)')
  })

  it('modify writer', async () => {
    await u2g1.shouldReply('#1 -W', '问答 1 因权限过低无法修改。')
    await u4g2.shouldReply('#1 -w foo', '选项 writer 输入无效，请指定正确的用户。')
    await u4g2.shouldReply('#1 -w [CQ:at,id=500]', '指定的目标用户不存在。')
    await u4g2.shouldReply('#1 -w [CQ:at,id=200]', '问答 1 已成功修改。')

    // 实在找不到名字就只显示未知用户
    await u4g2.shouldReply('#1', DETAIL_HEAD + '来源：未知用户')
    const getGroupMemberMap = app.bots[0].getGroupMemberMap = jest.fn()
    getGroupMemberMap.mockReturnValue(Promise.resolve({ 200: 'mock2' }))
    await u4g2.shouldReply('#1', DETAIL_HEAD + '来源：mock2')
    getGroupMemberMap.mockRestore()
  })

  it('anonymous', async () => {
    u2g1.meta.author.username = 'nick2'
    await u2g1.shouldReply('#1', DETAIL_HEAD + '来源：nick2 (200)')
    await u2g1.shouldReply('#1 -W', '问答 1 已成功修改。')
    await u2g1.shouldReply('#1', DETAIL_HEAD.slice(0, -1))
    await u2g1.shouldReply('#1 -p 0', '问答 1 因权限过低无法修改。')
  })

  it('frozen', async () => {
    await u3g1.shouldReply('# foo baz -f', '权限不足。')
    await u4g2.shouldReply('# foo bar -f', '修改了已存在的问答，编号为 1。')
    await u3g1.shouldReply('# foo bar -p 0', '问答 1 因权限过低无法修改。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '此问答已锁定。')
    await u3g1.shouldReply('## foo', SEARCH_HEAD + '1. [锁定] bar')
    await u4g2.shouldReply('#1 -F', '问答 1 已成功修改。')
  })

  it('substitute', async () => {
    app.command('bar', { authority: 3 }).action(() => 'test')
    await u3g1.shouldReply('#1 ~ $(bar) -w @300', '问答 1 已成功修改。')
    const DETAIL_SPECIAL = DETAIL_HEAD_QES + '回答：$(bar)\n来源：user3 (300)'
    await u3g1.shouldReply('#1', DETAIL_SPECIAL)
    await u2g1.shouldReply('foo', '权限不足。')

    await u3g1.shouldReply('#1 -s', '问答 1 已成功修改。')
    await u3g1.shouldReply('#1', DETAIL_SPECIAL + '\n回答中的指令由教学者代行。')
    await u3g1.shouldReply('## foo', SEARCH_HEAD + '1. [代行] $(bar)')
    await u2g1.shouldReply('foo', 'test')
  })
})
