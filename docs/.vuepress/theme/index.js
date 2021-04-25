module.exports = {
  extends: '@vuepress/theme-default',

  markdown: {
    code: false,
  },

  plugins: [
    ['@vuepress/palette', {
      preset: 'sass',
    }],
    [require('../markdown/highlight')],
    [require('../markdown/link')],
    [require('../markdown/github')],
    ['medium-zoom', {
      selector: '.theme-default-content :not(a) > img:not(.no-zooming)',
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
}
