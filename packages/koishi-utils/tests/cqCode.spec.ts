import { CQCode } from '../src'

describe('CQ Code', () => {
  test('escape', () => {
    expect(CQCode.escape('[CQ:at,qq=123]')).toBe('&#91;CQ:at,qq=123&#93;')
  })

  test('unescape', () => {
    expect(CQCode.unescape('&#91;CQ:at,qq=123&#93;')).toBe('[CQ:at,qq=123]')
  })

  test('stringify', () => {
    expect(CQCode.stringify('image', { file: 'https://test.com/?foo=1&bar=2,3' })).toBe('[CQ:image,file=https://test.com/?foo=1&amp;bar=2&#44;3]')
    expect(CQCode.stringify('share', { title: '', url: 'https://test.com', content: 'Hello' })).toBe('[CQ:share,url=https://test.com,content=Hello]')
  })

  test('parse', () => {
    expect(CQCode.parse('[CQ:image,')).toBeNull()
    expect(CQCode.parse('[CQ:image,file=https://test.com/?foo=1&amp;bar=2&#44;3]')).toMatchObject({
      type: 'image',
      data: { file: 'https://test.com/?foo=1&bar=2,3' },
    })
  })
})
