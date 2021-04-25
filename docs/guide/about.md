---
sidebarDepth: 2
noOutboundLinks: true
---

# 介绍

Koishi 是一个在 Node.js 环境下运行，基于 CoolQ 和 CQHTTP 的 QQ 机器人框架。

它的名字和图标设计来源于东方 Project 中的角色古明地恋（Komeiji Koishi）。

## 特性

### 开箱即用的 CLI

Koishi 高度配置化的命令行工具可以让你无需写代码就搭建属于你的机器人。与此同时，CLI 还配备了丰富和人性化的提示，进一步提高调试体验。

参见：[快速上手](./starter.md)

### 功能强大的 API

经过了几个版本的迭代，Koishi 已经发展出了丰富的 API，功能覆盖机器人领域的方方面面。从上层负责交互的指令、会话、中间件，再到中层负责控制的应用、上下文、插件，最后到底层的机器人和适配器，每一个部分都经过了精心的编写，可以让你轻松实现任何需求。

参见：[API 文档](../api/index.md)

### 丰富的生态系统

Koishi 在编写时，也同样编写了大量的官方插件作为补充。它们有些作为 Koishi 的基础功能，有些则为 Koishi 的使用提供了许多便利。更重要的是，这数十个插件都可以作为 Koishi 插件开发的极好示范。

参见：[官方插件](../plugins/index.md)

### 多账户与跨平台支持

Koishi 原生地支持了多账户与跨平台，同时为这些机器人之间互通数据、共用服务器、保证数据安全提供了原生的解决方案，这有助于在保持高性能的同时，将风控和迁移造成的影响降低到最小。

参见：[多账户与跨平台](./adapter.md)

### 类型与单元测试

Koishi 在开发时借助了下面的工具：

- 使用 [TypeScript](http://www.typescriptlang.org/) 编写
- 使用 [Mocha](https://mochajs.org/) 进行单元测试
- 使用 [Eslint](https://eslint.org/) 进行代码风格检查
- 使用 [GitHub Actions](https://github.com/features/actions) 进行持续集成

这既保证了其代码的正确性和可读性，也为使用 IDE 编写 Koishi 程序提供了极大的方便。
