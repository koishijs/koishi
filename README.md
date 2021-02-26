<div align="center">
  <a href="https://koishi.js.org/" target="_blank">
    <img width="160" src="https://koishi.js.org/koishi.png" alt="logo">
  </a>
  <h1 id="koishi"><a href="https://koishi.js.org/" target="_blank">Koishi</a></h1>

[![Codecov](https://img.shields.io/codecov/c/github/koishijs/koishi?style=flat-square)](https://codecov.io/gh/koishijs/koishi)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/koishijs/koishi.svg?style=flat-square)](https://lgtm.com/projects/g/koishijs/koishi/context:javascript)
[![npm](https://img.shields.io/npm/v/koishi?style=flat-square)](https://www.npmjs.com/package/koishi)
[![npm](https://img.shields.io/npm/v/koishi/next?style=flat-square)](https://www.npmjs.com/package/koishi/v/next)
[![GitHub](https://img.shields.io/github/license/koishijs/koishi?style=flat-square)](https://github.com/koishijs/koishi/blob/master/LICENSE)

</div>

Koishi 是一个在 [Node.js](https://nodejs.org/) 环境下运行的机器人框架，目前支持 [CQHTTP (OneBot)](https://github.com/howmanybots/onebot) 协议，在下个版本中也将支持 Telegram, 开黑啦等更多平台。

这个项目的名字和图标来源于东方 Project 中的角色古明地恋 (Komeiji Koishi)。

<div align="center">
<img src="./.github/demo.png" alt="demo" width="640">
</div>

## 安装

```sh
# 进入文件夹
cd my-bot

# 安装 Koishi
npm i koishi

# 初始化配置文件
koishi init

# 运行你的 Bot
koishi run
```

现在可以对你的机器人说话了：

```sh
> echo hello world
< hello world
```

**注意:** Koishi 要求您的 Node.js 的版本不小于 12。

## 应用案例

| 插件名 | <span align="center">功能描述</span> |
|:-:|:-:|
| [blame](https://github.com/ArilyChan/koishi-plugin-blame) | 拦截崩溃错误，推送到私信或群 |
| [gosen-choyen](https://github.com/idlist/koishi-plugin-gosen-choyen) | 生成并发送“我想要五千兆元！”风格的图片 |

| 项目地址 | <span align="center">简介</span> |
|:-:|:-:|
| [ArilyChan/qq-bot](https://github.com/ArilyChan/qq-bot) | 小阿日 |

欢迎[向上表中添加](https://github.com/koishijs/koishi/edit/master/README.md)自己的插件或机器人。

## 平台支持

### [koishi-adapter-cqhttp](./packages/adapter-cqhttp) [![npm](https://img.shields.io/npm/v/koishi-adapter-cqhttp?style=flat-square)](https://www.npmjs.com/package/koishi-adapter-cqhttp)

[CQHTTP (OneBot)](https://github.com/howmanybots/onebot) 协议支持，可与下列实现该协议的框架完美对接：

- [richardchien/coolq-http-api](https://github.com/richardchien/coolq-http-api)（可配合 [iTXTech/mirai-native](https://github.com/iTXTech/mirai-native) 使用）
- [Mrs4s/go-cqhttp](https://github.com/Mrs4s/go-cqhttp)
- [yyuueexxiinngg/cqhttp-mirai](https://github.com/yyuueexxiinngg/cqhttp-mirai)

请注意：尽管 Koishi 使用的协议是 [MIT](https://choosealicense.com/licenses/mit/) 协议，但上面陈述的三种途径的相关框架都使用了基于 [AGPL 3.0](https://choosealicense.com/licenses/agpl-3.0/) 的协议。因此**如果你使用 koishi-adapter-cqhttp 运行你的机器人，你将可能受到 AGPL 3.0 协议的限制，必须将你的代码开源并保持同协议**。Koishi 及其作者对使用上述框架或违反上述限制的行为所可能造成的一切后果概不负责。

### [koishi-adapter-tomon](./packages/adapter-tomon) [![npm](https://img.shields.io/npm/v/koishi-adapter-tomon?style=flat-square)](https://www.npmjs.com/package/koishi-adapter-tomon)

**[开发中]** [Tomon](https://tomon.fun) 平台支持。

## 数据库支持

### [koishi-plugin-mongo](./packages/plugin-mongo) [![npm](https://img.shields.io/npm/v/koishi-plugin-mongo?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-mongo)

MongoDB 支持。

### [koishi-plugin-mysql](./packages/plugin-mysql) [![npm](https://img.shields.io/npm/v/koishi-plugin-mysql?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-mysql)

MySQL 5.7 支持。

## 官方插件

### [koishi-plugin-chess](./packages/plugin-chess) [![npm](https://img.shields.io/npm/v/koishi-plugin-chess?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chess)

### [koishi-plugin-common](./packages/plugin-common) [![npm](https://img.shields.io/npm/v/koishi-plugin-common?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-common)

koishi-plugin-common 包含了一些常用功能，它们在你使用 koishi 库时是默认安装的。包含下列功能：

- 显示用户信息
- 管理用户和群数据
- 向一个或多个上下文发送消息
- 模拟来自其他会话的输入
- 输出聊天记录到控制台
- 欢迎入群，复读，处理申请，频率限制，自定义回复……

### [koishi-plugin-eval](https://koishi.js.org/plugins/eval.html) [![npm](https://img.shields.io/npm/v/koishi-plugin-eval?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-eval)

koishi-plugin-eval 允许用户直接使用机器人执行脚本。它利用了 Node.js 的 [vm](https://nodejs.org/api/vm.html) 和 [worker_threads](https://nodejs.org/api/worker_threads.html) 模块，在保护执行安全的前提下能够获得较快的响应速度。同时，插件还提供了一些内置的 API 供用户调用，结合教学功能可以在客户端实现复杂的行为。

### [koishi-plugin-eval-addons](https://koishi.js.org/plugins/eval.html) [![npm](https://img.shields.io/npm/v/koishi-plugin-eval-addons?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-eval-addons)

koishi-plugin-eval-addons 在前一个插件的基础上，允许用户编写自己的模块并永久保存。插件将自动加载特定目录下的文件，并将其作为机器人的内置功能。用户可以利用此功能存储较为复杂的代码，甚至扩展新的指令。同时，如果上述目录是一个 git 目录，该插件也提供了自动更新等机制。

### [koishi-plugin-github](./packages/plugin-github) [![npm](https://img.shields.io/npm/v/koishi-plugin-github?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-github)

koishi-plugin-github 提供了对 GitHub API 和 Webhooks 的全方位集成。它将允许机器人监听并群发目标仓库的更新，同时只需回复机器人的消息就能实现多种在 GitHub 网页中的操作。

### [koishi-plugin-image-search](./packages/plugin-image-search) [![npm](https://img.shields.io/npm/v/koishi-plugin-image-search?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-image-search)

### [koishi-plugin-monitor](./packages/plugin-monitor) [![npm](https://img.shields.io/npm/v/koishi-plugin-monitor?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monitor)

### [koishi-plugin-puppeteer](https://koishi.js.org/plugins/puppeteer.html) [![npm](https://img.shields.io/npm/v/koishi-plugin-puppeteer?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-puppeteer)

koishi-plugin-puppeteer 本身提供了网页截图（shot）指令和 TeX 渲染指令（tex），同时也封装了一系列与网页进行交互的接口。利用这些接口我们可以开发更多以渲染图片为基础的插件，如 koishi-plugin-chess 等。

### [koishi-plugin-rss](./packages/plugin-rss) [![npm](https://img.shields.io/npm/v/koishi-plugin-rss?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-rss)

koishi-plugin-rss 提供了 [RSS](https://en.wikipedia.org/wiki/RSS) 支持，允许不同的群订阅不同的 RSS 信息源并实时进行通知。

### [koishi-plugin-schedule](./packages/plugin-schedule) [![npm](https://img.shields.io/npm/v/koishi-plugin-schedule?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-schedule)

koishi-plugin-schedule 允许用户设置定时任务并执行。这些计划任务会被存储在数据库中，即使重启机器人也能继续工作。

### [koishi-plugin-status](./packages/plugin-status) [![npm](https://img.shields.io/npm/v/koishi-plugin-status?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-status)

### [koishi-plugin-teach](./packages/plugin-teach) [![npm](https://img.shields.io/npm/v/koishi-plugin-teach?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-teach)

### [koishi-plugin-tools](./packages/plugin-tools) [![npm](https://img.shields.io/npm/v/koishi-plugin-tools?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-tools)

## 协议

[MIT](./LICENSE) 维护良好的开源生态从我做起 (*>ω<)φ

Copyright © 2019-present, Shigma

## 联系

[![QQ群](https://img.shields.io/badge/QQ%E7%BE%A4-963697928-blue.svg?style=flat-square)](https://jq.qq.com/?_wv=1027&k=89G3oKG0)

本群只交流程序开发，不欢迎伸手党，禁止谈论商业行为。
