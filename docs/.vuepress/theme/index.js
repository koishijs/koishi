const { remove: removeDiacritics } = require('diacritics')
const { resolve } = require('path')

module.exports = {
  extends: '@vuepress/theme-default',
  layouts: resolve(__dirname, '../layouts'),

  markdown: {
    code: false,
    slugify (str) {
      const rControl = /[\u0000-\u001f]/g
      const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g
      return removeDiacritics(str)
        .replace(rControl, '')
        .replace(/\(.+\)(?=\s|$)/, '')
        .replace(rSpecial, '-')
        .replace(/\-{2,}/g, '-')
        .replace(/^\-+|\-+$/g, '')
        .replace(/^(\d)/, '_$1')
        .toLowerCase()
    },
  },

  plugins: [
    ['@vuepress/palette', {
      preset: 'sass',
    }],
    [require('../markdown/highlight')],
    [require('../markdown/github')],
    ['medium-zoom', {
      selector: '.theme-default-content :not(a) > img:not(.no-zooming)',
    }],
    ['@vuepress/pwa', {
      skipWaiting: true,
    }],
    ['@vuepress/docsearch', {
      apiKey: '24a872e49e34cdb7736d132917a308c6',
      indexName: 'koishi',
      searchParameters: {
        facetFilters: ['tags:latest'],
      },
    }],
    ['@vuepress/container', {
      type: 'code-group',
      before: (info) => {
        const [type] = info.split(' ', 1)
        const title = info.slice(type.length).trimStart()
        return `<panel-view class="code" type=${JSON.stringify(type)} title=${JSON.stringify(title)}>`
      },
      after: () => '</panel-view>',
    }],
  ],

  extendsPageData(page) {
    adjustSidebarItems(page.headers)
  },
}

function adjustSidebarItems(headers) {
  headers.forEach(header => {
    header.title = header.title.replace(/(\S)\(.+\)(?=\s|$)/, '$1()')
    if (header.children) {
      adjustSidebarItems(header.children)
    }
  })
}
