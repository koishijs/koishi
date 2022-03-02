const { getHighlighter, loadTheme } = require('shiki')
const { escapeHtml } = require('markdown-it/lib/common/utils')
const { resolve } = require('path')
const { setupForFile, transformAttributesToHTML } = require('remark-shiki-twoslash')

const cliAliases = ['npm', 'yarn']

const twoslashSupportedList = ['ts', 'js', 'twoslash']
const typeHeader = `
import {
  App,
  Session,
  Context,
  Service,
  Schema,
  Argv,
  Awaitable
} from 'koishi'

const app = new App()
const ctx = app
const cmd = ctx.command('koishi-docs-preserve')

// ---cut---

`

module.exports = {
  name: 'enhanced-highlight',

  async extendsMarkdown(md) {
    const tomorrow = await loadTheme(resolve(__dirname, 'tomorrow.json'))

    const { highlighters: twoslashHighlighters } = await setupForFile({
      theme: 'monokai',
    })

    const highlighter1 = await getHighlighter({
      theme: 'monokai',
    })

    const highlighter2 = await getHighlighter({
      theme: tomorrow,
      langs: [{
        id: 'cli',
        scopeName: 'source.batchfile',
        path: resolve(__dirname, 'batch.json'),
        aliases: cliAliases,
      }],
    })

    md.options.highlight = (code, lang, attrs) => {
      if (!lang) {
        return `<pre v-pre><code>${escapeHtml(code)}</code></pre>`
      }
      try {
        if (twoslashSupportedList.includes(lang)) {
          let noHeader = false
          if (code.includes('// @koishiDocsNoHeader')) {
            noHeader = true
            // Prevent flag escape
            code = code.replace('// @koishiDocsNoHeader', '')
          }
          let twoslashCode = noHeader ? code : typeHeader + code
          twoslashCode = twoslashCode.replace(/\r?\n$/, '')
          return transformAttributesToHTML(
            twoslashCode,
            [lang, 'twoslash', attrs].join(' '),
            twoslashHighlighters,
            {}
          )
        }
      } catch (e) {
        console.log('Code block:')
        console.log(e.code)
        console.log()
        console.log('Message:')
        console.log(e.message)
        console.log()
      }
      const h = lang === 'cli' || cliAliases.includes(lang) ? highlighter2 : highlighter1
      return h.codeToHtml(code, lang).replace('<pre', '<pre v-pre')
    }

    const fence = md.renderer.rules.fence
    md.renderer.rules.fence = (...args) => {
      let [tokens, index] = args, temp
      const token = tokens[index]
      if (!token.title) {
        const rawInfo = token.info || ''
        const titleExec = /title="(.*)"/g.exec(rawInfo)
        token.title = titleExec && titleExec[1] ? titleExec[1] : ''
      }
      const rawCode = fence(...args)
      while ((temp = tokens[--index])?.type === 'fence');
      const isCodeGroupItem = temp?.type === 'container_code-group_open'
      if (isCodeGroupItem) {
        return `<template #${token.info}>${rawCode}</template>`
      }
      let style = ''
      if (token.info.startsWith('cli')) style += `; background-color: ${tomorrow.bg}`
      return `<panel-view class="code" title=${JSON.stringify(token.title)} style="${style.slice(2)}">${rawCode}</panel-view>`
    }
  },
}
