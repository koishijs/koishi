---
sidebarDepth: 2
noOutboundLinks: true
---

# 介绍

Koishi 是一个基于 Node.js 的跨平台机器人框架。

它的名字和图标设计来源于东方 Project 中的角色古明地恋（Komeiji Koishi）。

## 特性

### 开箱即用的 CLI

Koishi 高度配置化的命令行工具可以让你无需写代码就搭建属于你的机器人。与此同时，CLI 还配备了丰富和人性化的提示，进一步提高调试体验。我们甚至还实现了**插件级别的 HMR（模块热替换）**，让你开发和调试插件也拥有如同前端开发一样的丝滑体验。

参见：[快速上手](./starter.md)

### 功能强大的 API

经过了几个版本的迭代，Koishi 已经发展出了丰富的 API，功能覆盖机器人领域的方方面面。从上层负责交互的指令、会话、中间件，再到中层负责控制的应用、上下文、插件，最后到底层的机器人和适配器，每一个部分都经过了精心的编写，可以让你轻松实现任何需求。如果担心在复杂的功能中迷失方向，我们也准备了细致的文档来提供帮助。

参见：[API 文档](../api/index.md)

### 丰富的生态系统

Koishi 在编写时，也同样编写了大量的官方插件作为补充。它们有些作为 Koishi 的基础功能，有些则为 Koishi 的使用提供了许多便利。更重要的是，这数十个插件都可以作为 Koishi 插件开发的极好示范。下面是一些例子：

- koishi-plugin-schedule：管理计划任务
- koishi-plugin-teach：教机器人说话
- koishi-plugin-webui：网页控制台

除了这些官方插件以外，社区贡献者也编写了各种各样的第三方插件：

- koishi-plugin-genshin：原神资料查询
- koishi-plugin-ink：展示视觉小说
- koishi-plugin-shell：执行终端命令

这些插件共同组成了 Koishi 如今的生态。

参见：[官方插件](../plugins/)

### 多账户与跨平台支持

Koishi 原生地支持了多账户与跨平台，同时为这些机器人之间互通数据、共用服务器、保证数据安全提供了原生的解决方案，这有助于在保持高性能的同时，将风控和迁移造成的影响降低到最小。Koishi 的用户甚至**可以在不同的平台间绑定数据**，使你无论切换到哪个平台，机器人都能记住你的用户信息。

除此以外，Koishi 还内置了一套用户管理机制，不仅几乎能满足一切需求，还具有良好的扩展性，任何人都可以在插件中扩展用户的字段。Koishi 的模块化开发使得这套机制并不仅限于单一的平台或者数据库。目前支持的平台已经包括 QQ (OneBot)，Telegram，Discord 等等，支持的数据库包括 MySQL (mariadb) 和 MongoDB。

参见：[多账户与跨平台](./adapter.md)

### 便利的网页控制台

Koishi v3 的另一大亮点就是拥有官方的网页控制台插件。这个控制台包含了非常多的功能：查看机器人运行状态、收集并展示统计数据、管理你的插件和依赖……

这个控制台本身的也提供了接口，允许其他插件来新增页面。当你安装了另一个插件 koishi-plugin-chat 之后，你甚至可以利用控制台，直接使用机器人的号进行聊天！

参见：[网页控制台](../plugins/other/webui.md)

### 类型与单元测试

Koishi 在开发时借助了下面的工具：

- 使用 [TypeScript](http://www.typescriptlang.org/) 编写
- 使用 [Mocha](https://mochajs.org/) 进行单元测试
- 使用 [Eslint](https://eslint.org/) 进行代码风格检查
- 使用 [GitHub Actions](https://github.com/features/actions) 进行持续集成

这既保证了其代码的正确性和可读性，也为使用 IDE 编写 Koishi 程序提供了极大的方便。
