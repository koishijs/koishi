<div align="center">
  <a href="https://koishi.js.org/" target="_blank">
    <img width="160" src="https://koishi.js.org/koishi.png" alt="logo">
  </a>
  <h1 id="koishi"><a href="https://koishi.js.org/" target="_blank">Koishi</a></h1>

[![Codecov](https://img.shields.io/codecov/c/github/koishijs/koishi?style=flat-square)](https://codecov.io/gh/koishijs/koishi)
[![npm](https://img.shields.io/npm/v/koishi?style=flat-square)](https://www.npmjs.com/package/koishi)
[![GitHub](https://img.shields.io/github/license/koishijs/koishi?style=flat-square)](https://github.com/koishijs/koishi/blob/master/LICENSE)

</div>

Koishi 是一个在 [Node.js](https://nodejs.org/) 环境下运行的跨平台机器人框架，目前可支持 [QQ](https://im.qq.com/)，[开黑啦](https://kaiheila.cn/)，[Telegram](https://telegram.org/)，[Discord](https://discord.com/) 等多个平台。

这个项目的名字和图标来源于东方 Project 中的角色古明地恋 (Komeiji Koishi)。

<div align="center">
<img src="./.github/demo.png" alt="demo" width="640">
</div>

## 快速上手

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

## 优秀特性

### 开箱即用的 CLI

Koishi 高度配置化的命令行工具可以让你无需写代码就搭建属于你的机器人。与此同时，CLI 还配备了丰富和人性化的提示，进一步提高调试体验。我们甚至还实现了**插件级别的 HMR（模块热替换）**，让你开发和调试插件也拥有如同前端开发一样的丝滑体验。

### 功能强大的 API

经过了几个版本的迭代，Koishi 已经发展出了丰富的 API，功能覆盖机器人领域的方方面面。从上层负责交互的指令、会话、中间件，再到中层负责控制的应用、上下文、插件，最后到底层的机器人和适配器，每一个部分都经过了精心的编写，可以让你轻松实现任何需求。如果担心在复杂的功能中迷失方向，我也准备了细致的文档来提供帮助。

### 丰富的生态系统

Koishi 在编写时，也同样编写了大量的官方插件作为补充。它们有些作为 Koishi 的基础功能，有些则为 Koishi 的使用提供了许多便利。更重要的是，这数十个插件都可以作为 Koishi 插件开发的极好示范。

### 多账户与跨平台支持

Koishi 原生地支持了多账户与跨平台，同时为这些机器人之间互通数据、共用服务器、保证数据安全提供了原生的解决方案，这有助于在保持高性能的同时，将风控和迁移造成的影响降低到最小。Koishi 的用户甚至可以**在不同的平台间绑定数据**，使你无论切换到哪个平台，机器人都能记住你的用户信息。

除此以外，Koishi 还内置了一套用户管理机制，不仅几乎能满足一切需求，还具有良好的扩展性，任何人都可以在插件中扩展用户的字段。Koishi 的模块化开发使得这套机制并不仅限于单一的平台或者数据库。目前支持的平台已经包括 QQ (OneBot)，Telegram，Discord 等等，支持的数据库包括 MySQL (mariadb) 和 MongoDB。

### 便利的网页控制台

Koishi v3 的另一大亮点就是拥有官方的网页控制台插件。这个控制台包含了非常多的功能：查看机器人运行状态、收集并展示统计数据、管理你的插件和依赖……

这个控制台本身的也提供了接口，允许其他插件来新增页面。当你安装了另一个插件 koishi-plugin-chat 之后，你甚至可以利用控制台，直接使用机器人的号进行聊天！

## 官方生态

### 平台支持

- koishi-adapter-onebot: [OneBot](https://github.com/howmanybots/onebot) 协议支持，可用于 QQ
- koishi-adapter-discord: [Discord](https://discord.com/) 平台支持
- koishi-adapter-telegram: [Telegram](https://telegram.org/) 平台支持
- koishi-adapter-kaiheila: [开黑啦](https://kaiheila.cn/) 平台支持

### 数据库支持

- koishi-plugin-mongo: MongoDB 支持
- koishi-plugin-mysql: MySQL 5.7 / MariaDB 10.5 支持

### 核心插件

[koishi-plugin-common](https://koishi.js.org/plugins/common/) 是一个插件合集，包含了一些最常用功能：

- 发送和广播消息
- 管理用户和频道数据
- 账号跨平台绑定
- 消息跨频道转发
- 输出聊天记录到控制台
- 定制复读，处理申请，自定义回复……

[koishi-plugin-eval](https://koishi.js.org/plugins/eval/) 允许用户直接使用机器人执行脚本。它利用了 Node.js 的 [vm](https://nodejs.org/api/vm.html) 和 [worker_threads](https://nodejs.org/api/worker_threads.html) 模块，在保护执行安全的前提下能够获得较快的响应速度。同时，插件还提供了一些内置的 API 供用户调用，并允许用户编写自己的模块并永久保存，甚至可以动态定义新的指令。

[koishi-plugin-teach](https://koishi.js.org/plugins/teach/) 允许用户在运行时编写问答并由机器人触发。每个人都可以随时随地修改机器人的行为，大大提高了互动的灵活性。支持概率控制、称呼匹配、指令插值、权限管理、频道过滤、正则匹配、后继问答等多种功能，足以应对绝大部分使用场景。

### 其他官方插件

- [koishi-plugin-assets](https://koishi.js.org/plugins/other/assets.html) / 资源转存
- [koishi-plugin-chess](https://koishi.js.org/plugins/other/chess.html) / 棋类游戏
- [koishi-plugin-github](https://koishi.js.org/plugins/other/github.html) / 接入 GitHub
- [koishi-plugin-image-search](https://koishi.js.org/plugins/other/image-search.html) / 图片搜索
- [koishi-plugin-puppeteer](https://koishi.js.org/plugins/other/puppeteer.html) / 网页截图
- [koishi-plugin-schedule](https://koishi.js.org/plugins/other/schedule.html) / 计划任务
- [koishi-plugin-tools](https://koishi.js.org/plugins/other/tools.html) / 实用工具
- [koishi-plugin-webui](https://koishi.js.org/plugins/other/webui.html) / 网页控制台

## 应用案例

欢迎[向下面的列表中添加](https://github.com/koishijs/koishi/edit/master/README.md)自己的插件或机器人。

### 社区插件

<!-- 左边填 npm 包名 -->

- [koishi-plugin-blame](https://github.com/ArilyChan/koishi-plugin-blame): 拦截崩溃错误，推送到私信或群
- [koishi-plugin-gosen-choyen](https://github.com/idlist/koishi-plugin-gosen-choyen): 生成并发送“我想要五千兆元！”风格的图片
- [koishi-plugin-genshin](https://github.com/koishijs/koishi-plugin-genshin): 查询原神国服玩家数据
- [koishi-plugin-ink](https://github.com/idlist/koishi-plugin-ink): 通过 [ink](https://github.com/inkle/ink) 展示视觉小说
- [koishi-plugin-bgp](https://github.com/Anillc/koishi-plugin-bgp): BGP 工具集！
- [koishi-plugin-dcqq-relay](https://github.com/XxLittleCxX/koishi-plugin-dcqq-relay): 同步 Discord 与 QQ 间的消息
- [koishi-plugin-forward](https://github.com/Anillc/forward): 将你的消息转发至其他平台！
- [koishi-plugin-animal-picture](https://github.com/idlist/koishi-plugin-animal-picture): 发送各种动物图片
- [koishi-plugin-shell](https://github.com/koishijs/koishi-plugin-shell): 使用 Koishi 执行终端命令
- [koishi-plugin-eval-enhance](https://github.com/Anillc/koishi-plugin-eval-enhance): koishi-plugin-eval的增强！
- [koishi-plugin-work](https://github.com/NWYLZW/koishi-plugin-work): 工作学习工具，已有功能 todos: 代办管理
- [koishi-plugin-aircon](https://github.com/idlist/koishi-plugin-aircon): 群空调
- [koishi-plugin-cryptocurrency](https://github.com/koishijs/plugin-cryptocurrency): 查看和订阅加密货币的市场价格
- [koishi-plugin-jrrp](https://github.com/idlist/koishi-plugin-jrrp): 今日人品
- [koishi-plugin-rpc](https://github.com/Anillc/koishi-plugin-rpc): 一个为其他插件提供 RPC 的插件
- [koishi-plugin-text-dialogue](https://github.com/koishijs/koishi-plugin-developer/tree/master/packages/plugin-text-dialogue): 支持在 md 文档中和你的 bot 对话
- [koishi-plugin-holiday](https://github.com/LolitaOT/koishi-plugin-holiday): 问问bot什么时候放假，什么时候休息
- [koishi-plugin-duplicate-checker](https://github.com/idlist/koishi-plugin-duplicate-checker) 火星图文出警器
- [@idlist/koishi-plugin-blive](https://github.com/idlist/koishi-plugin-blive) 另一个 B 站直播订阅

### 社区项目

<!-- 左边填 github 仓库 -->

- [ArilyChan/qq-bot](https://github.com/ArilyChan/qq-bot): 小阿日
- [hydro-dev/HydroBot](https://github.com/hydro-dev/HydroBot): A Simple QQ Robot
- [Wjghj-Project/Chatbot-SILI](https://github.com/Wjghj-Project/Chatbot-SILI): 「即时通讯软件转接姬」SILI-t137-[Tumita]-Invoke-II@LD(A)
- [idlist/2bot-v3](https://github.com/idlist/2bot-v3): 2bot，一个很 2 的 FFXIV bot
- [koishijs/koishi-plugin-developer](https://github.com/koishijs/koishi-plugin-developer): 使用 monorepo + ts + cli 开发你的 koishi 插件，已集成部分开发辅助功能。
- [koishijs/koishi-bots](https://github.com/koishijs/koishi-bots): 用于部署生产环境的 bot，并集合已有的 koishi bot。
- [Afanyiyu/qa-bot](https://github.com/Afanyiyu/qa-bot): 基于 plugin-teach 魔改的问答机器人，适用于客服/知识库等场景。

## 使用协议

Koishi 完全使用 [MIT](./LICENSE) 协议开源，维护良好的开源生态从我做起 (*>ω<)φ

Copyright © 2019-present, Shigma

## 贡献指南

[查看这里](./.github/contributing.md)

## 联系方式

[![Discord](https://img.shields.io/discord/811975252883800125?label=discord&style=flat-square)](https://discord.gg/xfxYwmd284)

本群只交流程序开发，不欢迎伸手党，禁止谈论商业行为。
