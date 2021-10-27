---
sidebarDepth: 2
---

# 术语表

本页收集了一些 Koishi 设计中的重要概念，按字母表序排列。如果你在阅读文档时对某个概念感到迷惑，可以随时回到这里查看解释。

## 适配器 (Adapter)

参考：

- [跨平台 / 使用适配器](../adapter/adapter.md)
- [API 文档 / 适配器 (Adapter)](../../api/core/adapter.md)

## 应用 (App)

参考：

- [API 文档 / 应用 (App)](../../api/core/app.md)

## 资源文件 (Assets)

在一些情况下，我们需要非即时地处理含有资源消息段的消息。由于涉及的消息会被长时间存储，在部分平台上将会导致资源链接的失效。通过 Assets 接口，我们可以将资源文件转存起来，并生成永久链接用于后续处理。

参考：

- [更多功能 / 存储资源文件](../service/assets.md)

## 机器人 (Bot)

参考：

- [API 文档 / 机器人 (Bot)](../../api/core/bot.md)

## 缓存 (Cache)

参考：

- [更多功能 / 使用缓存数据](../service/cache.md)

## 指令 (Command)

参考：

- [处理交互 / 指令系统初探](../message/command.md)
- [API 文档 / 指令 (Command)](../../api/core/command.md)

## 上下文 (Context)

参考：

- [复用性 / 使用上下文](../plugin/context.md)
- [API 文档 / 上下文 (Context)](../../api/core/context.md)

## 数据库 (Database)

参考：

- [数据库 / 使用数据库](../database/database.md)
- [API 文档 / 数据库 (Database)](../../api/core/database.md)

## 事件 (Events)

参考：

- [API 文档 / 事件 (Events)](../../api/core/events.md)

## 输出日志 (Logger)

参考：

- [API 文档 / 输出日志 (Logger)](../../api/utils/logger.md)

## 中间件 (Middleware)

参考：

- [处理交互 / 接收和发送消息](../message/middleware.md)

## 观察者 (Observer)

参考：

- [API 文档 / 观察者 (Observer)](../../api/utils/observer.md)

## 平台 (Platform)

## 插件 (Plugin)

参考：

- [复用性 / 使用插件](../plugin/plugin.md)

## 协议 (Protocol)

## 路由 (Router)

参考：

- [更多功能 / 提供网络服务](../service/router.md)

## 配置模式 (Schema)

参考：

- [API 文档 / 配置模式 (Schema)](../../api/utils/schema.md)

## 消息段 (Segment)

参考：

- [API 文档 / 消息段 (Segment)](../../api/utils/segment.md)

## 服务 (Service)

服务是一系列挂载于上下文对象上的功能的合集 (例如数据库和路由等)。为避免耦合，这些功能并不直接定义在上下文本身，而是将应用看作一个容器，通过依赖合并的方式来实现控制的反转。

参考：

- [更多功能 / 使用服务](../service/)

## 会话 (Session)

会话对象封装了一次上报事件所含有的属性以及其上的可用操作。你会在事件，中间件和指令的回调函数中用到它。此外，会话对象还提供了许多实用方法，足以满足绝大部分的使用场景。

参考：

- [处理交互 / 监听会话事件](../message/session.md)
- [API 文档 / 会话 (Session)](../../api/core/session.md)
