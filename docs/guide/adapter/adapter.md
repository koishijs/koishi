---
sidebarDepth: 2
---

# 使用适配器

::: danger 注意
这里是**正在施工**的 koishi v4 的文档。要查看 v3 版本的文档，请前往[这里](/)。
:::

如果要问我 Koishi 作为一个机器人框架最大的特色是什么，那我一定会回答是其多账户和跨平台机制。

使用多个机器人是 **负载均衡** 的一个重要部分。一方面，使用多个机器人可以有效地将每个机器人每天发送的信息数量限制在一个范围之内，从而降低因为风控到导致的账号问题出现的概率，同时即使出现了封号等问题，也能通过切换账号来妥善解决；另一方面，使用多个机器人可以将机器人的用户群分离，因为有助于通过配置的区别实现更好的颗粒化控制。

而跨平台则能够让你的机器人服务更大的用户群体。与此同时，如果你担心某个平台突然停止运营，或机器人被封禁，你完全可以丝滑地过渡到另一个平台上。更进一步，Koishi 允许用户进行 **跨平台的账号绑定**。即便你运营一个 TRPG 游戏或者有着深度定制的用户系统，跨平台也并不会增加用户迁移的成本。

## 使用多机器人

使用多个机器人有多种方法：

- 使用多台服务器运行机器人程序
- 在一台服务器的多个进程中运行机器人程序
- 在同一个进程运行多个机器人程序

当然，这三种方法并不是对立的，你完全可以同时使用上述三种方法中的两种或者更多。但是这里需要指出的是，如果使用前两种方法，由于这些机器人的运行程序本身是分离的，并不需要做特殊处理，同时你将可能面临数据竞争等问题。而对于第三种方法，机器人管理程序可以对每个账号进行妥善的管理，并且能够通过复用连接的形式获得更高的性能。因此，本章节将着重介绍同一进程的多机器人开发。

在 [快速上手](../introduction/coding.md#配置多机器人) 一章中我们已经给出了一个简单的例子：

::: code-group language koishi.config
```js
module.exports = {
  port: 7070,
  onebot: {
    // onebot 服务将在 http://localhost:7070/onebot 进行处理
    path: '/onebot',
    secret: 'my-secret',
  },
  kaiheila: {
    // kaiheila 服务将在 http://localhost:7070/kaiheila 进行处理
    path: '/kaiheila',
  },
  bots: [
    // 在这里写上不同的机器人配置
    { type: 'onebot:http', selfId: '123456789', server: 'http://onebot-server' },
    { type: 'onebot:ws', selfId: '987654321', token: 'my-onebot-token' },
    { type: 'kaiheila:ws', selfId: 'aAbBcCdD', token: 'my-kaiheila-token' },
  ],
}
```
```ts
// 这只是为了引入类型，本身没有作用
import { AppConfig } from 'koishi'
import {} from '@koishijs/plugin-onebot'
import {} from '@koishijs/plugin-kaiheila'

export default {
  port: 7070,
  onebot: {
    // onebot 服务将在 http://localhost:7070/onebot 进行处理
    path: '/event',
    secret: 'my-secret',
  },
  kaiheila: {
    // kaiheila 服务将在 http://localhost:7070/kaiheila 进行处理
    path: '/kaiheila',
  },
  bots: [
    // 在这里写上不同的机器人配置
    { type: 'onebot:http', selfId: '123456789', server: 'http://onebot-server' },
    { type: 'onebot:ws', selfId: '987654321', token: 'my-onebot-token' },
    { type: 'kaiheila:ws', selfId: 'aAbBcCdD', token: 'my-kaiheila-token' },
  ],
} as AppConfig
```
:::

这里是使用配置文件的写法，如果要使用 Koishi API，你只需要做一点变化：

::: code-group language index
```js
const { App } = require('koishi')

// 你需要手动安装所有相关平台的适配器
require('@koishijs/plugin-onebot')
require('@koishijs/plugin-kaiheila')

new App({ /* 同上述配置 */ })

// 启动应用
app.start()
```
```ts
import { App } from 'koishi'

// 你需要手动安装所有相关平台的适配器
import '@koishijs/plugin-onebot'
import '@koishijs/plugin-kaiheila'

new App({ /* 同上述配置 */ })

// 启动应用
app.start()
```
:::

让我们来简单地总结一下多机器人的配置方法：

1. 你需要提供一个 bots 配置项，它应该是一个数组，其中包含了每一个机器人的具体配置
2. 对适用于特定平台下每一个机器人的配置，你需要提供一个以平台名为名称的配置项（例如 onebot 等）
