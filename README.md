<div align="center">
  <a href="https://koishi.js.org/" target="_blank">
    <img width="160" src="https://koishi.js.org/koishi.png" alt="logo">
  </a>
  <h1 id="koishi"><a href="https://koishi.js.org/" target="_blank">Koishi</a></h1>

[![Codecov](https://img.shields.io/codecov/c/github/koishijs/koishi?style=flat-square)](https://codecov.io/gh/koishijs/koishi)
[![npm](https://img.shields.io/npm/v/koishi?style=flat-square)](https://www.npmjs.com/package/koishi)
[![GitHub](https://img.shields.io/github/license/koishijs/koishi?style=flat-square)](https://github.com/koishijs/koishi/blob/master/LICENSE)

</div>

Koishi 是一个在 [Node.js](https://nodejs.org/) 环境下运行的跨平台机器人框架，目前可支持 [QQ](https://im.qq.com/)，[Telegram](https://telegram.org/)，[Discord](https://discord.com/) 等多个平台。

这个项目的名字和图标来源于东方 Project 中的角色古明地恋 (Komeiji Koishi)。

## 快速上手

打开命令行，输入下面的指令，即可在当前目录下新建并启用一个带控制台的 Koishi 项目：

```sh
npm init koishi
# 或者
yarn create koishi
```

项目启动成功后，会自动为你打开一个浏览器界面，你可以使用界面中的控制台进行一系列操作，包括修改配置、安装插件和添加机器人。

## 特性

### 开箱即用的控制台

高度便利的控制台让你无需基础让你在几分钟之内搭建自己的聊天机器人。

- 提供在线插件市场，即使没有 js 编程基础，也能轻松在控制台中下载安装插件
- 支持 QQ，Telegram，Discord 等主流聊天平台，支持多账户和跨平台数据互通
- 随时随机通过控制面板监控运行状态，控制机器人的行为，甚至上号聊天

参见：[创建控制台项目](https://koishi.js.org/guide/introduction/console.html)

### 功能强大的 API

经过了几个版本的迭代，Koishi 已经发展出了丰富的 API，功能覆盖机器人领域的方方面面。从上层负责交互的指令、会话、中间件，再到中层负责控制的应用、上下文、插件，最后到底层的机器人和适配器，每一个部分都经过了精心的编写，可以让你轻松实现任何需求。如果担心在复杂的功能中迷失方向，我们也准备了细致的文档来提供帮助。

参见：[API 文档](https://koishi.js.org/api/)

### 丰富的生态系统

官方提供了大量插件和解决方案，覆盖了绝大多数常见需求的同时，也为开发提供了绝佳的范例。

- @koishijs/plugin-console：网页控制台
- @koishijs/plugin-schedule：计划任务
- @koishijs/plugin-teach：问答教学

除了这些官方插件以外，社区贡献者也编写了各种各样的第三方插件：

- koishi-plugin-genshin：原神资料查询
- koishi-plugin-ink：展示视觉小说
- koishi-plugin-shell：执行终端命令

这些插件共同组成了 Koishi 如今的生态。

参见：[官方插件](https://koishi.js.org/plugins/)

### 专为开发者打造

Koishi 更为开发者提供了众多专业功能，使开发者得以在各种复杂需求中构建规模化的解决方案。

#### 类型支持

Koishi 完全基于 TypeScript 开发，拥有顶级的类型支持，丰富的代码提示让你在编写代码的时候甚至无需查看文档。

#### 单元测试

所有核心功能均已经通过单元测试，既确保了可靠性，也为开发者提供了一套测试插件和定位问题的最佳实践。

#### 模块热重载

开发 Koishi 插件时，只需轻点保存即可热重载，无需频繁重启机器人，如同前端开发一样丝滑顺畅。

## 官方插件

### 平台支持

- [adapter-onebot](https://koishi.js.org/plugins/adapter/onebot.html): [OneBot](https://github.com/howmanybots/onebot) 协议支持，可用于 QQ
- [adapter-discord](https://koishi.js.org/plugins/adapter/discord.html): [Discord](https://discord.com/) 平台支持
- [adapter-telegram](https://koishi.js.org/plugins/adapter/telegram.html): [Telegram](https://telegram.org/) 平台支持
- [adapter-kaiheila](https://koishi.js.org/plugins/adapter/kaiheila.html): [开黑啦](https://kaiheila.cn/) 平台支持

### 静态资源存储

- [assets-jsdelivr](https://koishi.js.org/plugins/assets/jsdelivr.html): 使用 jsDelivr 和 GitHub 存储静态资源
- [assets-local](https://koishi.js.org/plugins/assets/local.html): 使用本地文件系统存储静态资源
- [assets-remote](https://koishi.js.org/plugins/assets/remote.html): 使用远程 Koishi 服务器存储静态资源
- [assets-s3](https://koishi.js.org/plugins/assets/s3.html): 使用 S3 存储静态资源

### 缓存支持

- [cache-lru](https://koishi.js.org/plugins/cache/lru.html): LRU 缓存支持
- [cache-redis](https://koishi.js.org/plugins/cache/redis.html): Redis 缓存支持

### 数据库支持

- [database-memory](https://koishi.js.org/plugins/database/memory.html): 测试用的内存数据库支持
- [database-mongo](https://koishi.js.org/plugins/database/mongo.html): MongoDB 数据库支持
- [database-mysql](https://koishi.js.org/plugins/database/mysql.html): MySQL 数据库支持
- [database-sqlite](https://koishi.js.org/plugins/database/sqlite.html): SQLite 数据库支持

### 网页控制台

- [chat](https://koishi.js.org/plugins/console/chat.html): 使用机器人账号聊天
- [console](https://koishi.js.org/plugins/console/): 网页控制台
- [manager](https://koishi.js.org/plugins/console/manager.html): 管理插件和机器人
- [status](https://koishi.js.org/plugins/console/status.html): 查看运行状态和统计数据

### 其他官方插件

- [admin](https://koishi.js.org/plugins/admin.html): 操作用户数据和频道数据
- [common](https://koishi.js.org/plugins/common.html): 常用指令合集
- [eval](https://koishi.js.org/plugins/eval.html): 对话机器人执行脚本
- [forward](https://koishi.js.org/plugins/forward.html): 转发消息到其他频道
- [github](https://koishi.js.org/plugins/github.html): GitHub 相关功能
- [mock](https://koishi.js.org/plugins/mock.html): 模拟消息、会话、网络请求
- [puppeteer](https://koishi.js.org/plugins/puppeteer.html): 网页截图和图片渲染
- [repeater](https://koishi.js.org/plugins/repeater.html): 复读机相关功能
- [schedule](https://koishi.js.org/plugins/schedule.html): 设置和执行计划任务
- [teach](https://koishi.js.org/plugins/teach.html): 教学问答系统
- [verifier](https://koishi.js.org/plugins/verifier.html): 处理好友和群组请求

## 应用案例

欢迎[向下面的列表中添加](https://github.com/koishijs/koishi/edit/master/README.md)自己的插件或机器人。

### 社区插件

<!-- 名称请链接到源码仓库，忽略 koishi-plugin- 前缀，按首字母排序 -->

| 名称 | 简介 |
|:----|:----|
| [adapter-minecraft](https://github.com/koishijs/koishi-plugin-adapter-minecraft) | Minecraft 适配器 |
| [assets-smms](https://github.com/koishijs/koishi-plugin-assets-smms) | 使用 sm.ms 存储静态资源文件 |
| [chess](https://github.com/koishijs/koishi-plugin-chess) | 棋类游戏 |
| [dice](https://github.com/koishijs/koishi-plugin-dice) | 掷骰 |
| [image-search](https://github.com/koishijs/koishi-plugin-image-search) | 图源搜索 |
| [pics](https://github.com/koishijs/koishi-plugin-pics) | 随机图片 |
| [rss](https://github.com/koishijs/koishi-plugin-rss) | RSS 订阅 |
| [srvpro-roomlist](https://code.mycard.moe/3rdeye/koishi-plugin-srvpro-roomlist) | [YGOPro](https://github.com/Fluorohydride/ygopro) 服务器房间列表查询 |
| [tabulate](https://code.mycard.moe/3rdeye/koishi-plugin-tabulate) | YGOCore 战队联盟友谊赛排表姬 |
| [tex](https://github.com/koishijs/koishi-plugin-tex) | TeX 渲染 |
| [thesaurus](https://code.mycard.moe/3rdeye/koishi-plugin-thesaurus) | 基于 [AnimeThesaurus](https://github.com/Kyomotoi/AnimeThesaurus) 的机器人聊天插件 |
| [tools](https://github.com/koishijs/koishi-plugin-tools) | 小功能合集 |
| [ygocard](https://code.mycard.moe/3rdeye/koishi-plugin-ygocard) | [YGOPro](https://github.com/Fluorohydride/ygopro) 卡查 |
| [ygotournament](https://code.mycard.moe/3rdeye/koishi-plugin-ygotournament) | [YGOPro](https://github.com/Fluorohydride/ygopro) 比赛主持辅助 |

### 社区项目

<!-- 名称请链接到源码仓库，新项目请添加到列表结尾 -->

| 名称 | 简介 |
|:----|:----|
| [2bot](https://github.com/idlist/2bot-v4) | 一个很 2 的 FFXIV bot |
| [koishi-nestjs](https://github.com/koishijs/koishi-nestjs) | 在 [Nest.js](https://nestjs.com/) 中使用 Koishi 开发规模化机器人应用 |
| [onebot-lb](https://github.com/purerosefallen/onebot-lb) | OneBot 负载均衡器 |
| [koishi-thirdeye](https://code.mycard.moe/3rdeye/koishi-thirdeye) | 装饰器以及 DI 风格的 Koishi 插件开发框架 |
| [koishi-bootstrap](https://code.mycard.moe/3rdeye/koishi-bootstrap) | Koishi 的 Docker 启动器 |

## 使用协议

Koishi 完全使用 [MIT](./LICENSE) 协议开源，维护良好的开源生态从我做起 (*>ω<)φ

Copyright © 2019-2022, Shigma

## 贡献指南

[请看这里](./.github/contributing.md)

## 联系方式

[![Discord](https://img.shields.io/discord/811975252883800125?label=discord&style=flat-square)](https://discord.gg/xfxYwmd284)

本群只交流程序开发，不欢迎伸手党，禁止谈论商业行为。
