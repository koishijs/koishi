import { CQCode } from '../src'

describe('CQ Code', () => {
  test('stringify', () => {
    expect(CQCode.stringify('image', { file: 'https://test.com/?foo=1&bar=2,3' })).toBe('[CQ:image,file=https://test.com/?foo=1&amp;bar=2&#44;3]')
    expect(CQCode.stringify('share', { title: '', url: 'https://test.com', content: 'Hello' })).toBe('[CQ:share,url=https://test.com,content=Hello]')
  })

  test('parse', () => {
    expect(CQCode.parse('[CQ:image,file=https://test.com/?foo=1&amp;bar=2&#44;3]')).toMatchObject({
      type: 'image',
      data: { file: 'https://test.com/?foo=1&bar=2,3' },
    })
  })
})
