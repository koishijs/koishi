import { segment } from 'koishi'
import { expect, use } from 'chai'
import shape from 'chai-shape'

use(shape)

describe('Segment API', () => {
  it('segment.escape()', () => {
    expect(segment.escape('[CQ:at,qq=123]')).to.equal('&#91;CQ:at,qq=123&#93;')
  })

  it('segment.unescape()', () => {
    expect(segment.unescape('&#91;CQ:at,qq=123&#93;')).to.equal('[CQ:at,qq=123]')
  })

  it('segment()', () => {
    expect(segment('image', { file: 'https://test.com/?foo=1&bar=2,3' })).to.equal('[CQ:image,file=https://test.com/?foo=1&amp;bar=2&#44;3]')
    expect(segment('share', { title: '', url: 'https://test.com', content: 'Hello' })).to.equal('[CQ:share,url=https://test.com,content=Hello]')
  })

  it('segment.join()', () => {
    expect(segment.join([
      { type: 'text', data: { content: 'foo' } },
      { type: 'bar', data: { text: 'bar' } },
      { type: 'text', data: { content: 'baz' } },
    ])).to.equal('foo[CQ:bar,text=bar]baz')
  })

  it('segment.from()', () => {
    expect(segment.from('[CQ:image,')).to.equal(null)
    expect(segment.from('[CQ:image,file=https://test.com/?foo=1&amp;bar=2&#44;3]')).to.deep.include({
      type: 'image',
      data: { file: 'https://test.com/?foo=1&bar=2,3' },
    })
  })

  it('segment.parse()', () => {
    expect(segment.parse('foo[CQ:bar,text=bar]')).to.have.shape([
      { type: 'text', data: { content: 'foo' } },
      { type: 'bar', data: { text: 'bar' } },
    ])
    expect(segment.parse('[CQ:bar,text=bar]baz')).to.have.shape([
      { type: 'bar', data: { text: 'bar' } },
      { type: 'text', data: { content: 'baz' } },
    ])
  })
})
