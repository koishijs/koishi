---
sidebarDepth: 2
---

# 多账户与跨平台

如果要问我 Koishi 作为一个机器人框架最大的特色是什么，那我一定会回答是其多账户和跨平台机制。

使用多个机器人是 **负载均衡** 的一个重要部分。一方面，使用多个机器人可以有效地将每个机器人每天发送的信息数量限制在一个范围之内，从而降低因为风控到导致的账号问题出现的概率，同时即使出现了封号等问题，也能通过切换账号来妥善解决；另一方面，使用多个机器人可以将机器人的用户群分离，因为有助于通过配置的区别实现更好的颗粒化控制。

而跨平台则能够让你的机器人服务更大的用户群体。与此同时，如果你担心某个平台突然停止运营，或机器人被封禁，你完全可以丝滑地过渡到另一个平台上。更进一步，Koishi 允许用户进行 **跨平台的账号绑定**。即便你运营一个 TRPG 游戏或者有着深度定制的用户系统，跨平台也并不会增加用户迁移的成本。

## 使用多机器人

使用多个机器人有多种方法：

- 使用多台服务器运行机器人程序
- 在一台服务器的多个进程中运行机器人程序
- 在同一个进程运行多个机器人程序

当然，这三种方法并不是对立的，你完全可以同时使用上述三种方法中的两种或者更多。但是这里需要指出的是，如果使用前两种方法，由于这些机器人的运行程序本身是分离的，并不需要做特殊处理，同时你将可能面临数据竞争等问题。而对于第三种方法，机器人管理程序可以对每个账号进行妥善的管理，并且能够通过复用连接的形式获得更高的性能。因此，本章节将着重介绍同一进程的多机器人开发。

在 [快速上手](./starter.md#配置多机器人) 一章中我们已经给出了一个简单的例子：

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
import {} from 'koishi-adapter-onebot'
import {} from 'koishi-adapter-kaiheila'

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
const { App } = require('koishi-core')

// 你需要手动安装所有相关平台的适配器
require('koishi-adapter-onebot')
require('koishi-adapter-kaiheila')

new App({ /* 同上述配置 */ })

// 启动应用
app.start()
```
```ts
import { App } from 'koishi-core'

// 你需要手动安装所有相关平台的适配器
import 'koishi-adapter-onebot'
import 'koishi-adapter-kaiheila'

new App({ /* 同上述配置 */ })

// 启动应用
app.start()
```
:::

让我们来简单地总结一下多机器人的配置方法：

1. 你需要提供一个 bots 配置项，它应该是一个数组，其中包含了每一个机器人的具体配置
2. 对适用于特定平台下每一个机器人的配置，你需要提供一个以平台名为名称的配置项（例如 onebot 等）

## 编写适配器

Koishi 通过 **适配器 (Adapter)** 实现对多账户和跨平台的实现。在我们开始之前，首先你需要了解多机器人在 Koishi 中究竟是以何种方式进行组织的。这个问题用一句话来说就是：一个应用可以有多个平台，每个平台可以有多个适配器，每个适配器可以有多个机器人。在上面的例子中，形如 onebot 的是 **平台名称**，形如 onebot:http 的是**适配器名称**。

当应用被创建时，它会按照配置创建所有的适配器和机器人实例。如果多个机器人使用了同一种适配器，那么会创建一个适配器实例绑定多个机器人。它们的关系用代码表示就是这样：

```ts
class App {
  // 可以使用 adapters[type] 找到对应的适配器
  adapters: Record<string, Adapter>
  // 可以使用 Array 方法遍历全部 bots
  // 也可以使用 bots[`${platform}:${selfId}`] 找到具体的某一个
  bots: Bot[] & Record<string, Bot>
}

class Adapter {
  // 可以使用 Array 方法遍历全部 bots
  // 也可以使用 bots[selfId] 找到具体的某一个
  bots: Bot[] & Record<string, Bot>
  // 所在的 App 实例
  app: App
}

class Bot {
  // 所在的 App 实例
  app: App
  // 所在的 Adapter 实例
  adapter: Adapter
}
```

当适配器收到一个上报事件时，它会首先对事件进行鉴权，并处理好改事件的响应值。接着这个适配器将按照事件的内容生成一个会话对象，并使用 `adapter.dispatch` 将其在对应的上下文触发事件。因此，如果你需要编写一个平台支持，你只需要做三件事：

- 编写这个平台的 Bot 类，实现 Koishi 所需的方法
- 编写这个平台的 Adapter 类，实现 start() 和 stop() 方法
- 注册这个 Adapter

### 一个 Webhook 例子

下面是一个使用 Webhook 的例子。适配器通过 http post 请求接受事件推送。

::: code-group language adapter
```js
const { Adapter, Bot, Session } = require('koishi-core')

class MyBot extends Bot {
  async sendMessage(channelId, content) {
    // 这里应该执行发送操作
    this.logger.debug('send:', content)
    return Random.uuid()
  }
}

class MyAdapter extends Adapter {
  constructor(app) {
    // 请注意这里的第二个参数是应该是一个构造函数而非实例
    super(app, MyBot)
  }

  start() {
    // 收到 http post 请求时，生成会话对象并触发事件
    this.app.router.post('/', (ctx) => {
      const session = new Session(this.app, ctx.request.body)
      this.dispatch(session)
    })
  }
}

// 注册适配器
Adapter.types['my-adapter'] = MyAdapter
```
```ts
import { Adapter, Bot, Session } from 'koishi-core'

class MyBot extends Bot {
  async sendMessage(channelId: string, content: string) {
    // 这里应该执行发送操作
    this.logger.debug('send:', content)
    return Random.uuid()
  }
}

class MyAdapter extends Adapter {
  constructor(app: App) {
    // 请注意这里的第二个参数是应该是一个构造函数而非实例
    super(app, MyBot)
  }

  start() {
    // 收到 http post 请求时，生成会话对象并触发事件
    this.app.router.post('/', (ctx) => {
      const session = new Session(this.app, ctx.request.body)
      this.dispatch(session)
    })
  }
}

// 注册适配器
Adapter.types['my-adapter'] = MyAdapter
```
:::

### 一个 WebSocket 例子

WebSocket 的逻辑相比 Webhook 要稍微复杂一些，因此我们提供了一个工具类：

::: code-group language adapter
```js
const { Adapter, Bot, Session } = require('koishi-core')
const WebSocket = require('ws')

class MyAdapter2 extends Adapter.WsClient {
  constructor(app) {
    // MyBot 跟上面一样，我就不写了
    super(app, MyBot)
  }

  // prepare 方法要求你返回一个 WebSocket 实例
  prepare(bot) {
    return new WebSocket('ws://websocket-endpoint')
  }

  // connect 方法将作为 socket.on('open') 的回调函数
  connect(bot) {
    bot.socket.on('message', (data) => {
      const body = JSON.parse(data.toString())
      const session = new Session(this.app, body)
      this.dispatch(session)
    })
  }
}

// 注册适配器
Adapter.types['another-adapter'] = MyAdapter2
```
```ts
import { Adapter, Bot, Session } from 'koishi-core'
import WebSocket from 'ws'

class MyAdapter2 extends Adapter.WsClient {
  constructor(app: App) {
    // MyBot 跟上面一样，我就不写了
    super(app, MyBot)
  }

  // prepare 方法要求你返回一个 WebSocket 实例
  prepare(bot: MyBot) {
    return new WebSocket('ws://websocket-endpoint')
  }

  // connect 方法将作为 socket.on('open') 的回调函数
  connect(bot: MyBot) {
    bot.socket.on('message', (data) => {
      const body = JSON.parse(data.toString())
      const session = new Session(this.app, body)
      this.dispatch(session)
    })
  }
}

// 注册适配器
Adapter.types['another-adapter'] = MyAdapter2
```
:::

### 适配器重定向

如果你嫌 onebot:http, onebot:ws 的写法太麻烦，不如试试下面的写法：

```js koishi.config.js
module.exports = {
  type: 'onebot',
  server: 'ws://localhost:6700',
}
```

启动程序，你将发现它也能按照 onebot:ws 的逻辑正常运行。这是因为 Koishi 提供了一个重定向方法，专门用于处理这种需求。你只需要这样定义即可：

```js
Adapter.types['onebot'] = Adapter.redirect((bot) => {
  return !bot.server ? 'onebot:ws-reverse'
    : bot.server.startsWith('ws') ? 'onebot:ws'
      : 'onebot:http'
})
```
