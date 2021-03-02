<div align="center">
  <a href="https://koishi.js.org/" target="_blank">
    <img width="160" src="https://koishi.js.org/koishi.png" alt="logo">
  </a>
  <h1 id="koishi"><a href="https://koishi.js.org/" target="_blank">Koishi</a></h1>

[![Codecov](https://img.shields.io/codecov/c/github/koishijs/koishi?style=flat-square)](https://codecov.io/gh/koishijs/koishi)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/koishijs/koishi.svg?style=flat-square)](https://lgtm.com/projects/g/koishijs/koishi/context:javascript)
[![npm](https://img.shields.io/npm/v/koishi?style=flat-square)](https://www.npmjs.com/package/koishi)
[![GitHub](https://img.shields.io/github/license/koishijs/koishi?style=flat-square)](https://github.com/koishijs/koishi/blob/master/LICENSE)

</div>

Koishi 是一个在 [Node.js](https://nodejs.org/) 环境下运行的跨平台机器人框架，目前可支持 [QQ](https://im.qq.com/)，[开黑啦](https://kaiheila.cn/)，[Telegram](https://telegram.org/)，[Discord](https://discord.com/) 等多个平台。

这个项目的名字和图标来源于东方 Project 中的角色古明地恋 (Komeiji Koishi)。

<div align="center">
<img src="./.github/demo.png" alt="demo" width="640">
<p style="font-size: 0.8em; color: gray">都已经 v3 了作者还用着 v2 的 demo 真的好吗？</p>
</div>

## 安装

```sh
# 进入文件夹
cd my-bot

# 安装 Koishi
yarn add koishi

# 初始化配置文件
yarn koishi init

# 运行你的 Bot
yarn koishi start
```

现在可以对你的机器人说话了：

```sh
> echo hello world
< hello world
```

完整版文档：https://koishi.js.org/guide/starter.html

## 应用案例

欢迎[向下面的列表中添加](https://github.com/koishijs/koishi/edit/master/README.md)自己的插件或机器人。

### 插件

<!-- 左边填 npm 包名 -->

- [koishi-plugin-blame](https://github.com/ArilyChan/koishi-plugin-blame): 拦截崩溃错误，推送到私信或群
- [koishi-plugin-gosen-choyen](https://github.com/idlist/koishi-plugin-gosen-choyen): 生成并发送“我想要五千兆元！”风格的图片

### 项目

<!-- 左边填 github 仓库 -->

- [ArilyChan/qq-bot](https://github.com/ArilyChan/qq-bot): 小阿日
- [hydro-dev/HydroBot](https://github.com/hydro-dev/HydroBot): A Simple QQ Robot

## 功能

### 平台支持

- koishi-adapter-onebot: [OneBot](https://github.com/howmanybots/onebot) 协议支持，可用于 QQ
- koishi-adapter-discord: [Discord](https://discord.com/) 平台支持
- koishi-adapter-telegram: [Telegram](https://telegram.org/) 平台支持
- koishi-adapter-kaiheila: [开黑啦](https://kaiheila.cn/) 平台支持

### 数据库支持

- koishi-plugin-mongo: MongoDB 支持。
- koishi-plugin-mysql: MySQL 5.7 / MariaDB 10.5 支持。

## 官方插件

插件文档：https://koishi.js.org/plugins/

### [koishi-plugin-chess](./packages/plugin-chess)

### [koishi-plugin-common](https://koishi.js.org/plugins/common/)

koishi-plugin-common 包含了一些常用功能，它们在你使用 koishi 库时是默认安装的。包含下列功能：

- 显示用户信息
- 管理用户和群数据
- 向一个或多个上下文发送消息
- 模拟来自其他会话的输入
- 输出聊天记录到控制台
- 欢迎入群，复读，处理申请，频率限制，自定义回复……

### [koishi-plugin-eval](https://koishi.js.org/plugins/eval/)

koishi-plugin-eval 允许用户直接使用机器人执行脚本。它利用了 Node.js 的 [vm](https://nodejs.org/api/vm.html) 和 [worker_threads](https://nodejs.org/api/worker_threads.html) 模块，在保护执行安全的前提下能够获得较快的响应速度。同时，插件还提供了一些内置的 API 供用户调用，并允许用户编写自己的模块并永久保存，结合教学功能可以在客户端实现复杂的行为。

### [koishi-plugin-github](./packages/plugin-github)

koishi-plugin-github 提供了对 GitHub API 和 Webhooks 的全方位集成。它将允许机器人监听并群发目标仓库的更新，同时只需回复机器人的消息就能实现多种在 GitHub 网页中的操作。

### [koishi-plugin-image-search](./packages/plugin-image-search)

### [koishi-plugin-monitor](./packages/plugin-monitor)

### [koishi-plugin-puppeteer](https://koishi.js.org/plugins/puppeteer.html)

koishi-plugin-puppeteer 本身提供了网页截图（shot）指令和 TeX 渲染指令（tex），同时也封装了一系列与网页进行交互的接口。利用这些接口我们可以开发更多以渲染图片为基础的插件，如 koishi-plugin-chess 等。

### [koishi-plugin-rss](./packages/plugin-rss)

koishi-plugin-rss 提供了 [RSS](https://en.wikipedia.org/wiki/RSS) 支持，允许不同的群订阅不同的 RSS 信息源并实时进行通知。

### [koishi-plugin-schedule](./packages/plugin-schedule)

koishi-plugin-schedule 允许用户设置定时任务并执行。这些计划任务会被存储在数据库中，即使重启机器人也能继续工作。

### [koishi-plugin-status](./packages/plugin-status)

### [koishi-plugin-teach](https://koishi.js.org/plugins/teach/)

### [koishi-plugin-tools](./packages/plugin-tools)

## 协议

[MIT](./LICENSE) 维护良好的开源生态从我做起 (*>ω<)φ

Copyright © 2019-present, Shigma

## 联系

[![QQ群](https://img.shields.io/badge/QQ%E7%BE%A4-963697928-blue.svg?style=flat-square)](https://jq.qq.com/?_wv=1027&k=89G3oKG0)

本群只交流程序开发，不欢迎伸手党，禁止谈论商业行为。
