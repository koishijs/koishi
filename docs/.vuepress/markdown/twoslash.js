const {
  setupForFile,
  transformAttributesToHTML,
} = require('remark-shiki-twoslash')

const twoslashSupportedList = ['ts', 'js', 'twoslash']
const extraHeader = `
import { resolve } from 'path'
import {
  App,
  Session,
  Context,
  Service,
  Schema,
  Argv,
  Awaitable
} from 'koishi'
import {
  Dict,
  segment
} from '@koishijs/utils'

const app = new App()
const ctx = app
const cmd = ctx.command('koishi-docs-preserve')

// ---cut---
`

let twoslashHighlighters

async function setupTwoslash() {
  const { highlighters } = await setupForFile({
    theme: 'monokai',
  })
  twoslashHighlighters = highlighters
}

function twoslash(code, lang, attrs) {
  if (!twoslashSupportedList.includes(lang)) return null

  try {
    const attrList = attrs.split(' ').map((x) => x.trim())
    if (attrList.includes('no-twoslash')) return null
    let twoslashCode = attrList.includes('no-extra-header')
      ? code
      : extraHeader + code
    twoslashCode = twoslashCode.replace(/\r?\n$/, '')
    return transformAttributesToHTML(
      twoslashCode,
      [lang, 'twoslash', attrs].join(' '),
      twoslashHighlighters,
      {}
    )
  } catch (e) {
    console.log('Code block:')
    console.log(e.code)
    console.log()
    console.log('Message:')
    console.log(e.message)
    console.log()
    return null
  }
}

module.exports = {
  setupTwoslash,
  twoslash,
}
