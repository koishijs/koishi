const { remove: removeDiacritics } = require('diacritics')
const { resolve } = require('path')

module.exports = {
  title: 'Koishi',
  theme: resolve(__dirname, 'theme'),
  bundler: '@vuepress/vite',

  head: [
    ['link', { rel: 'icon', href: `/koishi.png` }],
    ['link', { rel: 'manifest', href: '/manifest.json' }],
    ['meta', { name: 'theme-color', content: '#5546a3' }],
    // ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    // ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    // ['link', { rel: 'apple-touch-icon', href: `/icons/apple-touch-icon-152x152.png` }],
    // ['link', { rel: 'mask-icon', href: '/icons/safari-pinned-tab.svg', color: '#5546a3' }],
    // ['meta', { name: 'msapplication-TileImage', content: '/icons/msapplication-icon-144x144.png' }],
    // ['meta', { name: 'msapplication-TileColor', content: '#000000' }]
  ],

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

  themeConfig: {
    logo: '/koishi.png',
    navbar: [
      { text: '主页', link: '/' },
      { text: '指南', link: '/guide/starter.html' },
      { text: 'API', link: '/api/' },
      { text: '官方插件', link: '/plugins/' },
      { text: 'GitHub', link: 'https://github.com/koishijs/koishi' },
    ],
    sidebar: {
      '/guide/': [{
        text: '入门',
        isGroup: true,
        children: [
          '/guide/about.md',
          '/guide/starter.md',
          '/guide/cli.md',
          '/guide/docker.md',
          '/guide/faq.md',
        ],
      }, {
        text: '进阶',
        isGroup: true,
        children: [
          '/guide/message.md',
          '/guide/context.md',
          '/guide/command.md',
          '/guide/execute.md',
          '/guide/help.md',
          '/guide/manage.md',
          '/guide/database.md',
          '/guide/lifecycle.md',
          '/guide/adapter.md',
          '/guide/logger.md',
          '/guide/unit-tests.md',
          '/guide/decorator.md',
        ],
      }],
      '/api': [{
        text: '总览',
        link: '/api/',
      }, {
        text: '核心 API',
        isGroup: true,
        children: [
          '/api/context.md',
          '/api/app.md',
          '/api/bot.md',
          '/api/events.md',
          '/api/session.md',
          '/api/command.md',
          '/api/segment.md',
          '/api/database.md',
          '/api/adapter.md',
          '/api/global.md',
        ],
      }, {
        text: '其他官方包',
        isGroup: true,
        children: [
          '/api/utils.md',
          '/api/test-utils.md',
          '/api/adapter/onebot.md',
          '/api/adapter/telegram.md',
          '/api/adapter/discord.md',
          '/api/adapter/kaiheila.md',
          '/api/database/mongo.md',
          '/api/database/mysql.md',
        ],
      }, {
        text: '更新与迁移',
        isGroup: true,
        children: [
          '/api/changelog.md',
          '/api/migration.md',
        ],
      }],
      '/plugins/': [{
        text: '总览',
        link: '/plugins/',
      }, {
        text: '常用功能 (Common)',
        isGroup: true,
        children: [
          '/plugins/common/index.md',
          '/plugins/common/basic.md',
          '/plugins/common/handler.md',
          '/plugins/common/repeater.md',
          '/plugins/common/admin.md',
        ],
      }, {
        text: '教学系统 (Teach)',
        isGroup: true,
        children: [
          '/plugins/teach/index.md',
          '/plugins/teach/interp.md',
          '/plugins/teach/prob.md',
          '/plugins/teach/regexp.md',
          '/plugins/teach/context.md',
          // '/plugins/teach/prev-succ.md',
          '/plugins/teach/misc.md',
          '/plugins/teach/config.md',
        ],
      }, {
        text: '执行脚本 (Eval)',
        isGroup: true,
        children: [
          '/plugins/eval/index.md',
          '/plugins/eval/addon.md',
          '/plugins/eval/main.md',
          '/plugins/eval/worker.md',
          '/plugins/eval/sandbox.md',
          '/plugins/eval/config.md',
        ],
      }, ...process.env.NODE_ENV === 'production' ? [] : [{
        text: '冒险系统 (Adventure)',
        isGroup: true,
        children: [
          '/plugins/adventure/index.md',
          '/plugins/adventure/events.md',
        ],
      }], {
        text: '其他官方插件',
        isGroup: true,
        children: [
          '/plugins/other/assets.md',
          '/plugins/other/chat.md',
          '/plugins/other/chess.md',
          '/plugins/other/github.md',
          '/plugins/other/image-search.md',
          '/plugins/other/puppeteer.md',
          // '/plugins/other/rss.md',
          '/plugins/other/schedule.md',
          '/plugins/other/tools.md',
          '/plugins/other/webui.md',
        ],
      }],
    },
    lastUpdated: '上次更新',
    docsRepo: 'koishijs/koishi',
    docsDir: 'docs',
    docsBranch: 'develop',
    editLinks: true,
    editLinkText: '帮助我们改善此页面',

    themePlugins: {
      // only enable git plugin in production mode
      git: process.env.NODE_ENV === 'production',
    },
  },

  evergreen: () => false,// !context.isProd,
}
