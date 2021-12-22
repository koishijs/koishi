import createEnvironment from './environment'

const DETAIL_HEAD = '编号为 1 的问答信息：\n问题：foo\n回答：bar\n'
const SEARCH_HEAD = '问题“foo”的回答如下：\n'

describe('Teach Plugin - Context', () => {
  const { u3, u3g1, u3g2, u2g1 } = createEnvironment({ useContext: true })

  it('validate options 1', async () => {
    await u3.shouldReply('# foo bar', '非群聊上下文中请使用 -E/-D 进行操作或指定 -g, --guilds 选项。')
    await u3.shouldReply('# foo bar -g 100', '选项 -g, --guilds 必须与 -d/-D/-e/-E 之一同时使用。')
    await u3.shouldReply('# foo bar -eg 100', '问答已添加，编号为 1。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：本群')
    await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [e] bar')
  })

  it('validate options 2', async () => {
    await u3g1.shouldReply('#1 -de', '选项 -d, -e 不能同时使用。')
    await u3g1.shouldReply('#1 -DE', '选项 -D, -E 不能同时使用。')
    await u3g1.shouldReply('#1 -Dd', '选项 -D, -d 不能同时使用。')
    await u3g1.shouldReply('#1 -Ee', '选项 -E, -e 不能同时使用。')
  })

  it('limited guild enabled (with current guild)', async () => {
    await u3g2.shouldReply('# foo bar', '修改了已存在的问答，编号为 1。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：本群等 2 个群')
    await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [e] bar')
  })

  it('limited guild enabled (without current guild)', async () => {
    await u3g1.shouldReply('#1 -d', '问答 1 已成功修改。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：1 个群')
    await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [D] bar')
  })

  it('limited guild enabled (with no guilds)', async () => {
    await u3g1.shouldReply('#1 -D', '问答 1 已成功修改。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：全局禁止')
    await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [D] bar')
  })

  it('unlimited guild enabled (with all guilds)', async () => {
    await u3g1.shouldReply('#1 -E', '问答 1 已成功修改。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：全局')
    await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [E] bar')
  })

  it('unlimited guild enabled (with current guild)', async () => {
    await u3g1.shouldReply('#1 -dg 200', '问答 1 已成功修改。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：除 1 个群外的所有群')
    await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [E] bar')
  })

  it('unlimited guild enabled (without current guild)', async () => {
    await u3g1.shouldReply('#1 -d', '问答 1 已成功修改。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：除本群等 2 个群外的所有群')
    await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [d] bar')
  })

  it('limited guild enabled (with current guild only)', async () => {
    await u3g1.shouldReply('#1 -De', '问答 1 已成功修改。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：本群')
    await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [e] bar')
  })

  it('unlimited guild enabled (without current guild only)', async () => {
    await u3g1.shouldReply('#1 -Ed', '问答 1 已成功修改。')
    await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：除本群')
    await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [d] bar')
  })

  it('validate options 3', async () => {
    await u2g1.shouldReply('# foo baz -E', '权限不足。')
    await u2g1.shouldReply('# foo baz', '问答已添加，编号为 2。')
  })
})
