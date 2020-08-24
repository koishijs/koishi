import { CQCode } from 'koishi-utils'
import { expect } from 'chai'
import 'koishi-test-utils'

describe('CQ Code', () => {
  it('escape', () => {
    expect(CQCode.escape('[CQ:at,qq=123]')).to.equal('&#91;CQ:at,qq=123&#93;')
  })

  it('unescape', () => {
    expect(CQCode.unescape('&#91;CQ:at,qq=123&#93;')).to.equal('[CQ:at,qq=123]')
  })

  it('stringify', () => {
    expect(CQCode.stringify('image', { file: 'https://test.com/?foo=1&bar=2,3' })).to.equal('[CQ:image,file=https://test.com/?foo=1&amp;bar=2&#44;3]')
    expect(CQCode.stringify('share', { title: '', url: 'https://test.com', content: 'Hello' })).to.equal('[CQ:share,url=https://test.com,content=Hello]')
  })

  it('stringifyAll', () => {
    expect(CQCode.stringifyAll(['foo', {
      type: 'bar',
      data: { text: 'bar' },
    }, 'baz'])).to.equal('foo[CQ:bar,text=bar]baz')
  })

  it('parse', () => {
    expect(CQCode.parse('[CQ:image,')).to.equal(null)
    expect(CQCode.parse('[CQ:image,file=https://test.com/?foo=1&amp;bar=2&#44;3]')).to.deep.include({
      type: 'image',
      data: { file: 'https://test.com/?foo=1&bar=2,3' },
    })
  })

  it('parseAll', () => {
    expect(CQCode.parseAll('foo[CQ:bar,text=bar]')).to.have.shape(['foo', {
      type: 'bar',
      data: { text: 'bar' },
    }])
    expect(CQCode.parseAll('[CQ:bar,text=bar]baz')).to.have.shape([{
      type: 'bar',
      data: { text: 'bar' },
    }, 'baz'])
  })
})
