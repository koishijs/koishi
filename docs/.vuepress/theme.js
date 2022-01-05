module.exports = {
  extends: '@vuepress/theme-default',

  layouts: {
    Layout: require.resolve('./layouts/Layout.vue'),
    // Playground: require.resolve('@koishijs/ui-playground'),
  },

  plugins: [
    ['@vuepress/palette', {
      preset: 'sass',
    }],
    [require('./markdown/highlight')],
    [require('./markdown/github')],
    ['medium-zoom', {
      selector: '.theme-default-content :not(a) > img:not(.no-zooming)',
    }],
    ['@vuepress/pwa'],
    ['@vuepress/pwa-popup'],
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

  extendsPage(page) {
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
