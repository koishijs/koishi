import type { Theme, PageHeader } from '@vuepress/core'
import { defaultTheme } from '@vuepress/theme-default'
import type { DefaultThemeOptions } from '@vuepress/theme-default'
import pwa from '@vuepress/plugin-pwa'
import popup from '@vuepress/plugin-pwa-popup'
import container from '@vuepress/plugin-container'
import docsearch from '@vuepress/plugin-docsearch'
import zoom from '@vuepress/plugin-medium-zoom'
import { redirect } from 'vuepress-plugin-redirect2'

export default (options: DefaultThemeOptions): Theme => ({
  name: 'vuepress-theme-local',
  extends: defaultTheme(),

  layouts: {
    Layout: require.resolve('./layouts/Layout.vue'),
  },

  plugins: [
    [require('./markdown/highlight')],
    [require('./markdown/github')],
    pwa({}),
    popup({}),
    docsearch({
      appId: 'JDPYQL1A66',
      apiKey: '22055314b65e8198e43399540003b84b',
      indexName: 'koishi',
      searchParameters: {
        facetFilters: ['tags:latest'],
      },
    }),
    container({
      type: 'code-group',
      before: (info) => {
        const [type] = info.split(' ', 1)
        const title = info.slice(type.length).trimStart()
        return `<panel-view class="code" type=${JSON.stringify(type)} title=${JSON.stringify(title)}>`
      },
      after: () => '</panel-view>',
    }),
    zoom({
      selector: '.theme-default-content :not(a) > img:not(.no-zooming)',
    }),
  ],

  extendsPage(page) {
    adjustSidebarItems(page.headers)
  },
})

function adjustSidebarItems(headers: PageHeader[]) {
  headers.forEach(header => {
    header.title = header.title.replace(/(\S)\(.+\)(?=\s|$)/, '$1()')
    if (header.children) {
      adjustSidebarItems(header.children)
    }
  })
}
