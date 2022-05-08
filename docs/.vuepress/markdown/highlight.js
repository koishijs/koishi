const { getHighlighter, loadTheme } = require('shiki')
const { escapeHtml } = require('markdown-it/lib/common/utils')
const { resolve } = require('path')
const twoslash = require('./twoslash')

const cliAliases = ['npm', 'yarn']

module.exports = {
  name: 'enhanced-highlight',

  async extendsMarkdown(md) {
    const tomorrow = await loadTheme(resolve(__dirname, 'tomorrow.json'))

    await twoslash.setup()

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
      const twoslashHtml = twoslash.render(code, lang, attrs)
      if (twoslashHtml) return twoslashHtml.replace('<pre', '<pre v-pre')
      const h = lang === 'cli' || cliAliases.includes(lang) ? highlighter2 : highlighter1
      code = code
        .replace(/^[\s\S]*\/\/ ---cut---\r?\n/, '')
        .replace(/^[\s\S]*\/\/ @errors: \d+\r?\n/, '')
        .trim()
      return h.codeToHtml(code, { lang }).replace('<pre', '<pre v-pre')
    }

    const fence = md.renderer.rules.fence
    md.renderer.rules.fence = (...args) => {
      let [tokens, index] = args, temp
      const token = tokens[index]
      if (args[3].frontmatter.noTwoslash) token.info += ' no-twoslash'
      if (!token.title) {
        token.title = ''
        const rawInfo = token.info || ''
        let titleMatch = rawInfo
          .split(' ')
          .filter((x) => x.startsWith('title='))
        if (titleMatch.length) {
          titleMatch = titleMatch[0]
          token.info = rawInfo.replace(' ' + titleMatch, '')
          if (titleMatch.startsWith('title="') && titleMatch.endsWith('"')) {
            const titleExec = /title="(.*)"/g.exec(rawInfo)
            if (titleExec && titleExec[1]) token.title = titleExec[1]
          } else {
            const titleExec = /title=(.*)/g.exec(rawInfo)
            if (titleExec && titleExec[1]) token.title = titleExec[1]
          }
        }
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
