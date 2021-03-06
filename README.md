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

Koishi 高度配置化的命令行工具可以让你无需写代码就搭建属于你的机器人。与此同时，CLI 还配备了丰富和人性化的提示，进一步提高调试体验。

### 功能强大的 API

经过了几个版本的迭代，Koishi 已经发展出了丰富的 API，功能覆盖机器人领域的方方面面。从上层负责交互的指令、会话、中间件，再到中层负责控制的应用、上下文、插件，最后到底层的机器人和适配器，每一个部分都经过了精心的编写，可以让你轻松实现任何需求。

### 丰富的生态系统

Koishi 在编写时，也同样编写了大量的官方插件作为补充。它们有些作为 Koishi 的基础功能，有些则为 Koishi 的使用提供了许多便利。更重要的是，这数十个插件都可以作为 Koishi 插件开发的极好示范。

### 多账户与跨平台支持

Koishi 原生地支持了多账户与跨平台，同时为这些机器人之间互通数据、共用服务器、保证数据安全提供了原生的解决方案，这有助于在保持高性能的同时，将风控和迁移造成的影响降低到最小。

## 应用案例

欢迎[向下面的列表中添加](https://github.com/koishijs/koishi/edit/master/README.md)自己的插件或机器人。

### 社区插件

<!-- 左边填 npm 包名 -->

- [koishi-plugin-blame](https://github.com/ArilyChan/koishi-plugin-blame): 拦截崩溃错误，推送到私信或群
- [koishi-plugin-gosen-choyen](https://github.com/idlist/koishi-plugin-gosen-choyen): 生成并发送“我想要五千兆元！”风格的图片
- [koishi-plugin-genshin](https://github.com/Dragon-Fish/koishi-plugin-genshin): 查询原神国服玩家数据
- [koishi-plugin-iqdb](https://github.com/Dragon-Fish/koishi-plugin-iqdb): 使用 [iqdb.org](http://iqdb.org/) 搜图
- [koishi-plugin-ink](https://github.com/idlist/koishi-plugin-ink): 通过 [ink](https://github.com/inkle/ink) 展示视觉小说

### 社区项目

<!-- 左边填 github 仓库 -->

- [ArilyChan/qq-bot](https://github.com/ArilyChan/qq-bot): 小阿日
- [hydro-dev/HydroBot](https://github.com/hydro-dev/HydroBot): A Simple QQ Robot
- [Wjghj-Project/Chatbot-SILI](https://github.com/Wjghj-Project/Chatbot-SILI): 「即时通讯软件转接姬」SILI-t137-[Tumita]-Invoke-II@LD(A)

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

- [koishi-plugin-chess](https://koishi.js.org/plugins/other/chess.md) / 下棋
- [koishi-plugin-github](https://koishi.js.org/plugins/other/github.md) / 接入 GitHub
- [koishi-plugin-image-search](https://koishi.js.org/plugins/other/image-search.md) / 搜图
- [koishi-plugin-puppeteer](https://koishi.js.org/plugins/other/puppeteer.md) / 网页截图
- [koishi-plugin-rss](https://koishi.js.org/plugins/other/rss.md) / 订阅 RSS
- [koishi-plugin-schedule](https://koishi.js.org/plugins/other/schedule.md) / 设置计划任务
- [koishi-plugin-status](https://koishi.js.org/plugins/other/status.md) / 状态监控
- [koishi-plugin-tools](https://koishi.js.org/plugins/other/tools.md) / 实用工具

## 使用协议

Koishi 完全使用 [MIT](./LICENSE) 协议开源，维护良好的开源生态从我做起 (*>ω<)φ

Copyright © 2019-present, Shigma

## 联系方式

[![QQ群](https://img.shields.io/badge/QQ%E7%BE%A4-963697928-blue.svg?style=flat-square)](https://jq.qq.com/?_wv=1027&k=89G3oKG0)

本群只交流程序开发，不欢迎伸手党，禁止谈论商业行为。
