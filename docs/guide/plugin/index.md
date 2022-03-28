---
sidebarDepth: 2
---

# 认识插件

在 [直接调用 Koishi](../introduction/direct.md) 一章中，我们已经学习了基础的插件开发范例。本章将介绍更多的插件编写方式，以及一些场景下的最佳实践。

## 插件的基本形式

一个插件的本质是以下两个之一：

- 一个接受两个参数的函数，第一个参数是所在的上下文，第二个参数是传入的选项
- 一个对象，其中的 `apply` 方法是上面所说的函数

而一个插件在被加载时，则相当于进行了上述函数的调用。因此，下面的三种写法是基本等价的：

```ts
ctx.middleware(callback)

ctx.plugin(ctx => ctx.middleware(callback))

ctx.plugin({
  apply: ctx => ctx.middleware(callback),
})
```

看起来插件似乎只是将函数调用换了一种写法，但这种写法能够帮助我们将多个逻辑组合在一起并模块化，同时可以在插件内部对所需的选项进行初始化，这些都能极大地提高了代码的可维护性。

## 类形式的插件

由于 JavaScript 中类本身也是一种函数，因此我们也可以将插件写成类的形式。

::: code-group language example-plugin
```js no-extra-header
class ExamplePlugin {
  constructor(ctx, config) {
    // 你可以保存插件的上下文和选项
    this.ctx = ctx
    this.config = config

    // 上述插件的等价形式
    ctx.middleware(this.callback.bind(this))
  }

  callback(session, next) {}
}
```
```ts no-extra-header
import { Context, Next, Session } from 'koishi'

interface Config {}

class ExamplePlugin {
  // 保存插件的上下文和选项
  constructor(private ctx: Context, private config: Config) {
    // 上述插件的等价形式
    ctx.middleware(this.callback.bind(this))
  }

  callback(session: Session, next: Next) {}
}
```
:::

## 模块化的插件

一个模块可以作为插件被 Koishi 加载，其需要满足以下两条中的一条：

- 此模块的默认导出是一个插件
- 此模块的导出整体是一个插件

这两种写法并无优劣之分，你完全可以按照自己的需求调整导出的形式。按照惯例，如果你的插件是一个函数，我们通常直接导出 apply 方法，并将导出整体作为一个插件；如果你的插件是一个类，那么我们通常使用默认导出的形式。

::: tip
这里默认导出的优先级更高。因此，只要模块提供了默认导出，Koishi 就会尝试加载这个默认导出，而不是导出整体。在开发中请务必注意这一点。
:::

## 具名插件

插件如果使用对象式，那么除了 `apply` 以外，你还可以提供一个 `name` 属性，它便是插件的名称。对于函数和类形式的插件来说，插件名称便是函数名或类名。具名插件有助于更好地描述插件的功能，并被用于插件关系可视化中，实际上不会影响任何运行时的行为。

例如，下面给出了一个插件的例子，它实现了检测说话带空格的功能：

::: code-group language detect-space
```js no-extra-header
module.exports.name = 'detect-space'

module.exports.apply = (ctx) => {
  ctx.middleware((session, next) => {
    if (session.content.match(/^\s*(\S +){2,}\S\s*$/g)) {
      return '在？为什么说话带空格？'
    } else {
      return next()
    }
  })
}
```
```ts no-extra-header
import { Context } from 'koishi'

export default function detectSpace(ctx: Context) {
  ctx.middleware((session, next) => {
    if (session.content.match(/^\s*(\S +){2,}\S\s*$/g)) {
      return '在？为什么说话带空格？'
    } else {
      return next()
    }
  })
}
```
:::

## 嵌套插件

Koishi 的插件也是可以嵌套的。你可以将你编写的插件解耦成多个独立的子插件，再用一个父插件作为入口，就像这样：

::: code-group language nested-plugin
```js no-extra-header
// 在 a.js, b.js 中编写两个不同的插件
const pluginA = require('./a')
const pluginB = require('./b')

module.exports.apply = (ctx) => {
  // 依次安装 a, b 两个插件
  ctx.plugin(pluginA)
  ctx.plugin(pluginB)
}
```
```ts no-extra-header
// @errors: 2307

// 在 a.ts, b.ts 中编写两个不同的插件
import { Context } from 'koishi'
import pluginA from './a'
import pluginB from './b'

export default function (ctx: Context) {
  // 依次安装 a, b 两个插件
  ctx.plugin(pluginA)
  ctx.plugin(pluginB)
}
```
:::

这样当你加载 nested-plugin 时，就相当于同时加载了 a 和 b 两个插件。

Koishi 的许多插件都采用了这种写法，例如 [koishi-plugin-tools](https://github.com/koishijs/koishi-plugin-tools)。

## 卸载插件

通常来说一个插件的效应应该是永久的，但如果你想在运行时卸载一个插件，应该怎么做？你可以使用 `ctx.dispose()` 方法来解决：

```ts no-extra-header
declare const app: import('koishi').App

// ---cut---
// @errors: 2304

import { Context } from 'koishi'

function callback(ctx: Context, options) {
  // 编写你的插件逻辑
  ctx.on('message', eventCallback)
  ctx.command('foo').action(commandCallback)
  ctx.middleware(middlewareCallback)
  ctx.plugin(require('another-plugin'))
}

// 加载插件
app.plugin(callback)

// 卸载这个插件，取消上面的全部操作
app.dispose(callback)
```

看起来很神奇，不过它的实现方式也非常简单。当一个插件被注册时，Koishi 会记录注册过程中定义的所有事件钩子、指令、中间件乃至子插件。当 `ctx.dispose()` 被调用时，再逐一取消上述操作的效应。因此，它的局限性也很明显：它并不能妥善处理除了 Context API 以外的**副作用**。不过，我们也准备了额外的解决办法：

::: code-group language my-plugin
```js no-extra-header
module.exports = (ctx, options) => {
  const server = createServer()

  ctx.on('ready', () => {
    // ctx.dispose 无法消除 server.listen 带来的副作用
    server.listen(1234)
  })

  // 添加一个特殊的回调函数来处理副作用
  ctx.on('dispose', () => {
    server.close()
  })
}
```
```ts no-extra-header
import { Context } from 'koishi'

export default function (ctx: Context, options) {
  const server = createServer()

  ctx.on('ready', () => {
    // ctx.dispose 无法消除 server.listen 带来的副作用
    server.listen(1234)
  })

  // 添加一个特殊的回调函数来处理副作用
  ctx.on('dispose', () => {
    server.close()
  })
}
```
:::
