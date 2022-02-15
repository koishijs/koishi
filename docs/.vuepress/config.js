const { resolve } = require('path')
const { remove: removeDiacritics } = require('diacritics')

function devOnly(value) {
  return process.env.NODE_ENV === 'production' ? [] : [value]
}

module.exports = {
  base: '/',
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
      {
        text: 'v4.x',
        children: [{
          text: 'v3.x',
          link: 'https://koishi.js.org/v3/',
        }, {
          text: 'v1.x',
          link: 'https://koishi.js.org/v1/',
        }],
      },
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
          '/guide/introduction/console.md',
          '/guide/introduction/coding.md',
          '/guide/introduction/cli.md',
          // '/guide/introduction/comparison.md',
          '/guide/introduction/workspace.md',
          // '/guide/introduction/glossary.md',
        ],
      }, {
        text: '处理交互',
        isGroup: true,
        children: [
          '/guide/message/middleware.md',
          '/guide/message/session.md',
          '/guide/message/message.md',
        ],
      }, {
        text: '指令系统',
        isGroup: true,
        children: [
          '/guide/command/command.md',
          '/guide/command/execution.md',
          '/guide/command/help.md',
        ],
      }, {
        text: '模块化',
        isGroup: true,
        children: [
          '/guide/plugin/plugin.md',
          '/guide/plugin/context.md',
          '/guide/plugin/lifecycle.md',
          '/guide/plugin/service.md',
          '/guide/plugin/schema.md',
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
          '/guide/adapter/bot.md',
          '/guide/adapter/binding.md',
          '/guide/adapter/writing.md',
        ],
      }, {
        text: '更多功能',
        isGroup: true,
        children: [
          '/guide/service/assets.md',
          '/guide/service/http.md',
          '/guide/service/router.md',
          '/guide/service/logger.md',
        ],
      }, {
        text: '控制台开发',
        isGroup: true,
        children: [
          '/guide/console/index.md',
          '/guide/console/extension.md',
          '/guide/console/data.md',
        ],
      }, {
        text: '调试与部署',
        isGroup: true,
        children: [
          '/guide/misc/unit-tests.md',
          '/guide/misc/decorators.md',
          '/guide/misc/docker.md',
        ],
      }],

      '/api/': [{
        text: '总览',
        link: '/api/',
      }, {
        text: '核心 API',
        isGroup: true,
        children: [
          '/api/core/adapter.md',
          '/api/core/app.md',
          '/api/core/bot.md',
          '/api/core/command.md',
          '/api/core/context.md',
          '/api/core/events.md',
          '/api/core/session.md',
        ],
      }, {
        text: '数据库 API',
        isGroup: true,
        children: [
          '/api/database/built-in.md',
          '/api/database/database.md',
          '/api/database/model.md',
          '/api/database/query.md',
          '/api/database/evaluation.md',
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
        text: '控制台开发',
        isGroup: true,
        children: [
          '/api/console/server.md',
          '/api/console/client.md',
        ],
      }, {
        text: '更新与迁移',
        isGroup: true,
        children: [
          '/api/migration.md',
          '/api/releases/v4.1.md',
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
          '/plugins/adapter/qqguild.md',
          '/plugins/adapter/telegram.md',
        ],
      }, {
        text: '数据库支持',
        isGroup: true,
        children: [
          '/plugins/database/level.md',
          '/plugins/database/memory.md',
          '/plugins/database/mongo.md',
          '/plugins/database/mysql.md',
          '/plugins/database/sqlite.md',
        ],
      }, {
        text: '资源存储支持',
        isGroup: true,
        children: [
          '/plugins/assets/git.md',
          '/plugins/assets/local.md',
          '/plugins/assets/remote.md',
          '/plugins/assets/s3.md',
        ],
      }, {
        text: '常用功能',
        isGroup: true,
        children: [
          '/plugins/common/broadcast.md',
          '/plugins/common/echo.md',
          '/plugins/common/feedback.md',
          '/plugins/common/forward.md',
          '/plugins/common/recall.md',
          '/plugins/common/repeater.md',
          '/plugins/common/respondent.md',
        ],
      }, {
        text: '辅助功能',
        isGroup: true,
        children: [
          '/plugins/accessibility/admin.md',
          '/plugins/accessibility/bind.md',
          '/plugins/accessibility/callme.md',
          '/plugins/accessibility/rate-limit.md',
          '/plugins/accessibility/schedule.md',
          '/plugins/accessibility/sudo.md',
          '/plugins/accessibility/verifier.md',
        ],
      }, {
        text: '控制台功能',
        isGroup: true,
        children: [
          '/plugins/console/index.md',
          '/plugins/console/chat.md',
          '/plugins/console/commands.md',
          '/plugins/console/dataview.md',
          '/plugins/console/insight.md',
          '/plugins/console/logger.md',
          '/plugins/console/manager.md',
          '/plugins/console/status.md',
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
          '/plugins/other/github.md',
          '/plugins/other/mock.md',
          '/plugins/other/puppeteer.md',
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
