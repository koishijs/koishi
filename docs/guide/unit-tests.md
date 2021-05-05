---
sidebarDepth: 2
---

# 单元测试

::: danger 注意
这里是**正在施工**的 koishi v3 的文档。要查看 v1 版本的文档，请前往[**这里**](/v1/)。
:::

如果你是一位插件开发者，比起让机器人真正运行起来，你或许会更希望使用**单元测试**，因为它具有许多前者所不具有的优点：

- 可以在无网络的情况下运行
- 可以模拟出多用户交互等复杂情况
- 可以在内存中模拟你想要的数据库
- 能够有效避免风控带来的损失
- 便于调试与错误定位

本章将介绍官方库 `koishi-test-utils`。它一个基于 [Mocha](https://mochajs.org/) 和 [Chai](https://www.chaijs.com/) 的单元测试工具集，你可以用它来快速检验你编写的 Koishi 插件和数据库实现。

## 准备工作

安装最新版本的 Mocha, Chai 和 koishi-test-utils：

::: code-group manager
```npm
npm i mocha chai koishi-test-utils -D
```
```yarn
yarn add mocha chai koishi-test-utils -D
```
:::

::: tip 提示
你可以在 [这里](../api/test-utils.md) 看到完整的接口列表和所需的最低版本。
:::

### 使用 TypeScript

如果你使用 TypeScript 进行开发，你可能还需要下面这些依赖（当然你可能已经安装了它们）：

::: code-group manager
```npm
npm i typescript ts-node @types/node @types/mocha @types/chai -D
```
```yarn
yarn add typescript ts-node @types/node @types/mocha @types/chai -D
```
:::

接着编辑你的 `.mocharc.js` 文件：

```js .mocharc.js
module.exports = {
  extension: ['ts'],
  require: [
    'ts-node/register/transpile-only',
    'tsconfig-paths/register',
  ],
}
```

## 模拟事件上报

当你不希望真正用服务器却希望测试 App 对某个事件上报的响应时，你可以使用 MockedApp 来模拟一次事件上报：

```js
const { MockedApp } = require('koishi-test-utils')

// 这里的 MockedApp 是 App 的一个子类，因此你仍然可以像过去那样编写代码
const app = new MockedApp()

// 这是一个简单的中间件例子，下面将测试这个中间件
app.middleware(({ message, send }, next) => {
  if (message === '天王盖地虎') return send('宝塔镇河妖')
  return next()
})

test('example', async () => {
  // 尝试接收一个 message 事件
  await app.receiveMessage('user', '天王盖地虎', 123)

  // 判断 app 应该最终发送了这个请求
  // 这里的请求名相当于 sender 中对应的接口名，不用写 async
  // 请求参数与 sender 相一致
  app.shouldHaveLastRequest('send_private_msg', {
    userId: 123,
    message: '宝塔镇河妖',
  })

  // 再次尝试接收一个 message 事件
  await app.receiveMessage('user', '宫廷玉液酒', 123)

  // 判断 app 应该最终没有发送任何请求
  app.shouldHaveNoRequests()
})
```

## 模拟会话

Koishi 本身不需要会话的概念，因为 Meta 对象本身就具有 [快捷操作](./message.md#快捷操作) 功能。但是在单元测试中，我们可能经常需要让一个用户多次向机器人发送信息，这时一个会话系统就变得非常有用了。

```js
const { MockedApp } = require('koishi-test-utils')

// 创建一个无服务端的 App 实例
const app = new MockedApp()

// 创建一个 QQ 号为 123 的私聊会话
const session = app.createSession('user', 123)

// 还是刚刚那个例子
app.middleware(({ message, send }, next) => {
  if (message === '天王盖地虎') return send('宝塔镇河妖')
  return next()
})

test('example', () => {
  // 将 foo 发送给机器人将会获得 bar 的回复
  await session.shouldHaveResponse('天王盖地虎', '宝塔镇河妖')

  // 将 foo 发送给机器人将会获得某些回复
  await session.shouldHaveResponse('天王盖地虎')

  // 将 foo 发送给机器人后将会获得与快照一致的回复
  await session.shouldMatchSnapshot('天王盖地虎')

  // 将 foo 发送给机器人将不会获得任何回复
  await session.shouldHaveNoResponse('宫廷玉液酒')
})
```

## 模拟服务器

如果你想使用真正的 HTTP / WebSocket 服务器来测试，Koishi 也提供了相应的办法：

```js
const { createHttpServer } = require('koishi-test-utils')

test('example', async () => {
  // 创建一个真正的 CQHTTP 服务端
  const server = await createHttpServer(token)

  // 创建一个与之关联的 App
  const app = server.createBoundApp()

  // 运行 Koishi 应用
  await app.start()

  // 服务端向 Koishi 上报事件
  await server.post(meta)

  // 设置客户端请求的结果
  server.setResponse(method, data)

  // 判断上一次请求的内容
  server.shouldHaveLastRequest(method, params)

  // 关闭服务端和所有关联的 App
  await server.close()
})
```

## 模拟工具函数

如果我们编写的插件中含有延时或者随机效果，测试工作会变得困难不少——因为我们希望所有测试的行为都能在短时间内符合预期地完成。这个时候，koishi-test-utils 也提供了一种解决方式。

```js
// 这里的 utils 相当于 koishi-utils 的一个副本
// 在此基础上额外提供了测试时进行控制的方法
const { utils } = require('koishi-test-utils')

// 此后插件中的 randomPick() 调用将永远返回数组的第一个元素
utils.randomPick.mockIndex(0)

// 此后插件中的 randomInt() 调用将永远返回 3
utils.randomInt.mockReturnValue(3)

// 此后插件中的 sleep() 调用将不等待直接返回 Promise.resolve()
utils.sleep.mockResolvedValue()
```

这些函数也有对应的 once 版本，它们将只生效一次：

```js
// 下一次插件中的 randomPick() 调用将返回数组的第一个元素
utils.randomPick.mockIndexOnce(0)

// 下一次插件中的 randomInt() 调用将返回 3
utils.randomInt.mockReturnValueOnce(3)

// 下一次插件中的 sleep() 调用将不等待直接返回 Promise.resolve()
utils.sleep.mockResolvedValueOnce()
```

## 模拟数据库

koishi-database-memory 是 Koishi 的一个数据库实现，只不过它将所有数据都留在内存中，方便调试：

```js
const { App } = require('koishi-core')
require('koishi-database-memory')

// 使用内存数据库
const app = new App({
  database: { memory: {} },
})
```

当然你也可以和上面的 MockedApp 结合起来使用：

```js
const { MockedApp } = require('koishi-test-utils')
require('koishi-database-memory')

// 使用内存数据库
const app = new MockedApp({
  database: { memory: {} },
})
```

## 测试数据库

你可以使用 `testDatabase()` 方法测试你编写的数据库。下面是一个简单的例子，它测试了我们刚刚介绍的内存数据库：

```js
const { testDatabase } = require('koishi-test-utils')
require('koishi-database-memory')

testDatabase({ memory: {} })

// 传入两个参数
// 第一个参数是 App 的构造选项中的 database 参数
// 第二个参数是每个测试阶段要执行的钩子函数，这些函数将用于手动清理数据库
testDatabase({ memory: {} }, {
  beforeEachUser: app => app.database.memory.store.user = [],
  beforeEachGroup: app => app.database.memory.store.group = [],
})
```

这个函数将测试所有 [内置的数据库方法](../api/database.md) 是否已经被实现。

除此以外，你还可以测试你扩展的数据库接口，就像这样：

```js
const { testDatabase } = require('koishi-test-utils')

// 返回一个 App 实例
const app = testDatabase(options, hooks)

test('other methods', () => {
  // do something with `app`
})
```
