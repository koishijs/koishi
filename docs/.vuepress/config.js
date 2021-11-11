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
      { text: '指南', link: '/guide/introduction/' },
      { text: 'API', link: '/api/' },
      { text: '官方插件', link: '/plugins/' },
      // ...devOnly({ text: '演练场', link: '/playground.html' }),
    ],
    sidebar: {
      '/guide/': [{
        text: '入门',
        isGroup: true,
        children: [
          '/guide/introduction/index.md',
          '/guide/introduction/coding.md',
          '/guide/introduction/console.md',
          '/guide/introduction/glossary.md',
        ],
      }, {
        text: '处理交互',
        isGroup: true,
        children: [
          '/guide/message/middleware.md',
          '/guide/message/session.md',
          '/guide/message/command.md',
          '/guide/message/execution.md',
          '/guide/message/help.md',
          '/guide/message/message.md',
        ],
      }, {
        text: '模块化',
        isGroup: true,
        children: [
          '/guide/plugin/plugin.md',
          '/guide/plugin/context.md',
          '/guide/plugin/lifecycle.md',
          '/guide/plugin/schema.md',
          '/guide/plugin/publish.md',
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
        text: '更多功能',
        isGroup: true,
        children: [
          '/guide/service/index.md',
          '/guide/service/assets.md',
          '/guide/service/cache.md',
          '/guide/service/http.md',
          '/guide/service/route.md',
          '/guide/service/logger.md',
        ],
      }, {
        text: '调试与部署',
        isGroup: true,
        children: [
          '/guide/misc/cli.md',
          '/guide/misc/unit-tests.md',
          '/guide/misc/decorator.md',
          '/guide/misc/docker.md',
        ],
      }, {
        text: '贡献指南',
        isGroup: true,
        children: [
          '/guide/contribution/structure.md',
          '/guide/contribution/code.md',
          '/guide/contribution/docs.md',
        ],
      }],
      '/api/': [{
        text: '总览',
        link: '/api/',
      }, {
        text: '核心 API',
        isGroup: true,
        children: [
          '/api/core/context.md',
          '/api/core/app.md',
          '/api/core/bot.md',
          '/api/core/events.md',
          '/api/core/session.md',
          '/api/core/command.md',
          '/api/core/database.md',
          '/api/core/adapter.md',
        ],
      }, {
        text: '其他内置 API',
        isGroup: true,
        children: [
          '/api/utils/segment.md',
          '/api/utils/schema.md',
          '/api/utils/observer.md',
          '/api/utils/template.md',
          '/api/utils/logger.md',
          '/api/utils/misc.md',
        ],
      }, {
        text: '其他官方包',
        isGroup: true,
        children: [
          '/api/tools/cli.md',
          '/api/tools/dev-utils.md',
          '/api/tools/test-utils.md',
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
        text: '适配器支持',
        isGroup: true,
        children: [
          '/plugins/adapter/discord.md',
          '/plugins/adapter/kaiheila.md',
          '/plugins/adapter/onebot.md',
          '/plugins/adapter/telegram.md',
        ],
      }, {
        text: '数据库支持',
        isGroup: true,
        children: [
          '/plugins/database/database.md',
          '/plugins/database/mongo.md',
          '/plugins/database/mysql.md',
        ],
      }, {
        text: '资源存储支持',
        isGroup: true,
        children: [
          '/plugins/assets/assets.md',
          '/plugins/assets/jsdelivr.md',
          '/plugins/assets/s3.md',
        ],
      }, {
        text: '缓存支持',
        isGroup: true,
        children: [
          '/plugins/cache/cache.md',
          '/plugins/cache/redis.md',
        ],
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
