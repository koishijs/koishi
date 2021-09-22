const { resolve } = require('path')
const { remove: removeDiacritics } = require('diacritics')

function devOnly(value) {
  return process.env.NODE_ENV === 'production' ? [] : [value]
}

module.exports = {
  base: '/v4/',
  title: 'Koishi',
  theme: resolve(__dirname, 'theme'),
  bundler: '@vuepress/vite',

  head: [
    ['link', { rel: 'icon', href: `/koishi.png` }],
    ['link', { rel: 'manifest', href: '/manifest.json' }],
    ['meta', { name: 'theme-color', content: '#5546a3' }],
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
      ...devOnly({ text: '演练场', link: '/playground.html' }),
      { text: 'GitHub', link: 'https://github.com/koishijs/koishi' },
    ],
    sidebar: {
      '/guide/': [{
        text: '入门',
        isGroup: true,
        children: [
          '/guide/about.md',
          '/guide/starter.md',
          '/guide/advanced/cli.md',
        ],
      }, {
        text: '处理交互',
        isGroup: true,
        children: [
          '/guide/message/message.md',
          '/guide/message/command.md',
          '/guide/message/execute.md',
          '/guide/message/help.md',
        ],
      }, {
        text: '复用性',
        isGroup: true,
        children: [
          '/guide/reusability/plugin.md',
          '/guide/reusability/context.md',
          '/guide/reusability/hot-reload.md',
          '/guide/reusability/lifecycle.md',
          '/guide/reusability/schema.md',
        ],
      }, {
        text: '数据库',
        isGroup: true,
        children: [
          '/guide/database/database.md',
          '/guide/database/builtin.md',
          '/guide/database/observer.md',
          '/guide/database/writing.md',
        ],
      }, {
        text: '跨平台',
        isGroup: true,
        children: [
          '/guide/adapter/adapter.md',
          '/guide/adapter/binding.md',
          '/guide/adapter/writing.md',
          '/guide/adapter/for-everything.md',
        ],
      }, {
        text: '规模化',
        isGroup: true,
        children: [
          '/guide/scaling-up/assets.md',
          '/guide/scaling-up/cache.md',
          '/guide/scaling-up/route.md',
        ],
      }, {
        text: '更多',
        isGroup: true,
        children: [
          '/guide/advanced/logger.md',
          '/guide/advanced/unit-tests.md',
          '/guide/advanced/decorator.md',
          '/guide/advanced/docker.md',
          '/guide/faq.md',
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
          '/api/schema.md',
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
      }, ...devOnly({
        text: '冒险系统 (Adventure)',
        isGroup: true,
        children: [
          '/plugins/adventure/index.md',
          '/plugins/adventure/events.md',
        ],
      }), {
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
    docsBranch: 'next',
    editLinks: true,
    editLinkText: '帮助我们改善此页面',

    themePlugins: {
      // only enable git plugin in production mode
      git: process.env.NODE_ENV === 'production',
    },
  },

  bundlerConfig: {
    viteOptions: {
      plugins: [
        require('@rollup/plugin-yaml')(),
      ],
      // build: {
      //   // fix for monaco workers
      //   // https://github.com/vitejs/vite/issues/1927#issuecomment-805803918
      //   rollupOptions: {
      //     output: {
      //       inlineDynamicImports: false,
      //       manualChunks: {
      //         tsWorker: ['monaco-editor/esm/vs/language/typescript/ts.worker'],
      //         editorWorker: ['monaco-editor/esm/vs/editor/editor.worker'],
      //       },
      //     },
      //   },
      // },
    },
  },
}
