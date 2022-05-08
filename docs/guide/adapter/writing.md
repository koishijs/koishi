---
sidebarDepth: 2
---

# 编写适配器插件

::: danger 注意
这里是**正在施工**的 koishi v4 的文档。要查看 v3 版本的文档，请前往[这里](/)。
:::

Koishi 通过 **适配器 (Adapter)** 实现对多账户和跨平台的实现。在我们开始之前，首先你需要了解多机器人在 Koishi 中究竟是以何种方式进行组织的。这个问题用一句话来说就是：一个应用可以有多个平台，每个平台可以有多个适配器，每个适配器可以有多个机器人。在上面的例子中，形如 onebot 的是 **平台名称**，形如 onebot:http 的是**适配器名称**。

当应用被创建时，它会按照配置创建所有的适配器和机器人实例。如果多个机器人使用了同一种适配器，那么会创建一个适配器实例绑定多个机器人。它们的关系用代码表示就是这样：

```ts no-extra-header
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
```js no-extra-header
const { Adapter, Bot, Session } = require('koishi')

class MyBot extends Bot {
  async sendMessage(channelId, content) {
    // 这里应该执行发送操作
    this.logger.debug('send:', content)
    return []
  }
}

class MyAdapter extends Adapter {
  constructor(ctx) {
    // 请注意这里的第二个参数是应该是一个构造函数而非实例
    super(ctx, MyBot)
  }

  start() {
    // 收到 http post 请求时，生成会话对象并触发事件
    this.ctx.router.post('/', (ctx) => {
      const session = new Session(this.app, ctx.request.body)
      this.dispatch(session)
    })
  }

  stop() {}
}

// 注册适配器
Adapter.types['my-adapter'] = MyAdapter
```
```ts no-extra-header
import { App, Adapter, Bot, Session } from 'koishi'

class MyBot extends Bot {
  async sendMessage(channelId: string, content: string) {
    // 这里应该执行发送操作
    this.logger.debug('send:', content)
    return []
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

  stop() {}
}

// 注册适配器
Adapter.types['my-adapter'] = MyAdapter
```
:::

### 一个 WebSocket 例子

WebSocket 的逻辑相比 Webhook 要稍微复杂一些，因此我们提供了一个工具类：

::: code-group language adapter
```js no-extra-header
const { Adapter, Bot, Session } = require('koishi')
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
```ts no-extra-header
import { Adapter, Bot, Session } from 'koishi'
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
