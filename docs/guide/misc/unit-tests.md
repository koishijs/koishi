---
sidebarDepth: 2
---

# 单元测试

如果你是一位插件开发者，比起让机器人真正运行起来，你或许会更希望使用**单元测试**，因为它具有许多前者所不具有的优点：

- 可以在无网络的情况下运行
- 可以模拟出多用户交互等复杂情况
- 可以在内存中模拟你想要的数据库
- 能够有效避免风控带来的损失
- 便于调试与错误定位

本章将介绍官方插件 `@koishijs/plugin-mock`。你可以用它来快速检验你编写的 Koishi 插件。

::: tip
本节中介绍的样例用到了 [Mocha](https://mochajs.org/) 和 [Chai](https://www.chaijs.com/)。它们都是比较通用的测试库和断言库，但并非绑定 @koishijs/plugin-mock 一同使用。你也可以根据你的喜好选择其他工具，比如 [Jest](https://jestjs.io/) 等等。
:::

## 准备工作

安装所需的测试工具以及 @koishijs/plugin-mock：

::: code-group manager
```npm
npm i mocha chai @koishijs/plugin-mock -D
```
```yarn
yarn add mocha chai @koishijs/plugin-mock -D
```
:::

接着创建存放测试文件的 `tests` 目录，并在其中新建一个 `index.spec.js` 文件，开始编写你的单元测试：

```ts title=tests/index.spec.js
import { App } from 'koishi'
import mock from '@koishijs/plugin-mock'

const app = new App()
app.plugin(mock)
```

### 使用 TypeScript

如果你使用 TypeScript 进行开发，你可能还需要下面这些依赖 (当然你可能已经安装了它们)：

::: code-group manager
```npm
npm i typescript ts-node @types/node @types/mocha @types/chai -D
```
```yarn
yarn add typescript ts-node @types/node @types/mocha @types/chai -D
```
:::

接着编辑你的 `.mocharc.js` 文件：

```js title=.mocharc.js
module.exports = {
  extension: ['ts'],
  require: [
    'ts-node/register/transpile-only',
    'tsconfig-paths/register',
  ],
}
```

## 模拟会话消息

对于聊天机器人来说最常见的需求是处理用户的消息。为此，我们提供了 **客户端 (Client)** 对象，用于模拟特定频道和用户的输入：

```ts no-extra-header
/// <reference types="mocha" />
// ---cut---
import { App } from 'koishi'
import mock from '@koishijs/plugin-mock'

const app = new App()
app.plugin(mock)

// 创建一个 userId 为 123 的私聊客户端
const client = app.mock.client('123')

// 这是一个简单的中间件例子，下面将测试这个中间件
app.middleware(({ content }, next) => {
  if (content === '天王盖地虎') {
    return '宝塔镇河妖'
  } else {
    return next()
  }
})

// 这一句不能少，要等待 app 启动完成
before(() => app.start())

it('example 1', async () => {
  // 将“天王盖地虎”发送给机器人将会获得“宝塔镇河妖”的回复
  await client.shouldReply('天王盖地虎', '宝塔镇河妖')

  // 将“天王盖地虎”发送给机器人将会获得某些回复
  await client.shouldReply('天王盖地虎')

  // 将“宫廷玉液酒”发送给机器人将不会获得任何回复
  await client.shouldNotReply('宫廷玉液酒')
})
```

## 模拟数据库

@koishijs/plugin-database-memory 是 Koishi 的一个基于内存的数据库实现，非常适合用于单元测试。

```ts no-extra-header
import { App } from 'koishi'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'

const app = new App()
app.plugin(mock)
app.plugin(memory)

// 这次我们来测试一下这个指令
app.command('foo', { authority: 2 }).action(() => 'bar')

// 创建两个来自不同用户的客户端对象
const client1 = app.mock.client('123')
const client2 = app.mock.client('456')

before(async () => {
  await app.start()

  // 在数据库中初始化两个用户，userId 分别为 123 和 456，权限等级分别为 1 和 2
  // app.mock.initUser() 方法本质上只是 app.database.createUser() 的语法糖
  await app.mock.initUser('123', 1)
  await app.mock.initUser('456', 2)
})

it('example 2', async () => {
  // 用户 123 尝试调用 foo 指令，但是权限不足
  await client1.shouldReply('foo', '权限不足。')

  // 用户 456 得以正常调用 foo 指令
  await client2.shouldReply('foo', 'bar')
})
```
