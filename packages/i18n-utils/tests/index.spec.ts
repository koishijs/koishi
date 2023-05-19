import { expect } from 'chai'
import { fallback } from '../src'

describe('@koishijs/i18n-utils', () => {
  it('single fallbacking', () => {
    expect(fallback({
      'zh': { 'zh-CN': {}, 'zh-TW': {} },
      'en': { 'en-US': {}, 'en-GB': {} },
    }, ['zh-TW'])).to.deep.equal(['zh-TW', 'zh', 'zh-CN', '', 'en', 'en-US', 'en-GB'])

    expect(fallback({
      'zh': { 'zh-CN': {}, 'zh-TW': {} },
      'en': { 'en-US': {}, 'en-GB': {} },
    }, ['en'])).to.deep.equal(['en', 'en-US', 'en-GB', '', 'zh', 'zh-CN', 'zh-TW'])

    expect(fallback({
      'zh': { 'zh-CN': {}, 'zh-TW': {} },
      'en': { 'en-US': {}, 'en-GB': {} },
    }, ['de-DE'])).to.deep.equal(['', 'zh', 'zh-CN', 'zh-TW', 'en', 'en-US', 'en-GB'])
  })

  it('multiple fallbacking', () => {
    expect(fallback({
      'zh': { 'zh-CN': {}, 'zh-TW': {} },
      'en': { 'en-US': {}, 'en-GB': {} },
    }, ['en', 'zh-TW'])).to.deep.equal(['en', 'en-US', 'en-GB', 'zh-TW', 'zh', 'zh-CN', ''])

    expect(fallback({
      'zh': { 'zh-CN': {}, 'zh-TW': {} },
      'en': { 'en-US': {}, 'en-GB': {} },
    }, ['zh-TW', 'en'])).to.deep.equal(['zh-TW', 'en', 'en-US', 'en-GB', 'zh', 'zh-CN', ''])

    expect(fallback({
      'zh': { 'zh-CN': {}, 'zh-TW': {} },
      'en': { 'en-US': {}, 'en-GB': {} },
    }, ['en', 'de-DE', 'en-GB'])).to.deep.equal(['en', 'en-US', 'en-GB', '', 'zh', 'zh-CN', 'zh-TW'])

    expect(fallback({
      'zh': { 'zh-CN': {}, 'zh-TW': {} },
      'en': { 'en-US': {}, 'en-GB': {} },
    }, ['en-GB', 'zh-CN', 'en'])).to.deep.equal(['en-GB', 'zh-CN', 'en', 'en-US', 'zh', 'zh-TW', ''])
  })
})
