---
sidebarDepth: 2
---

# 使用插件

Koishi 官方实现了许多功能，但一个机器人很可能只会用到其中的一部分。因此我们采用了插件化的方式，将不同的功能解耦到了不同的包中。你可以在 [官方插件](../plugins/index.md) 中了解到各种不同的功能。

### 安装插件

在之前的文档中，我们已经展示了如何通过配置文件和脚本调用两种方法使用插件，它们的写法略有不同。让我们先回顾一下：

::: code-group config koishi.config
```yaml
plugins:
  ./my-plugin:  # 传给 my-plugin 的配置项
  console:      # 传给 @koishijs/plugin-common 的配置项
```
```js
module.exports = {
  plugins: {
    './my-plugin': {}, // 传给 my-plugin 的配置项
    'common': {},      // 传给 @koishijs/plugin-common 的配置项
  },
}
```
```ts
export default {
  plugins: {
    './my-plugin': {}, // 传给 my-plugin 的配置项
    'common': {},      // 传给 @koishijs/plugin-common 的配置项
  },
}
```
:::

`plugins` 是一个对象，其中的每一个键表示一个插件的路径。

- 如果是一个绝对路径或者相对路径，我们会相对 koishi.config.js 所在的目录进行解析
- 其他情况下我们将其视为包名，并允许省略 koishi-plugin- 这个前缀，并考虑 scope 带来的影响（例如对于 foo/bar，我们将尝试读取 koishi-plugin-foo/bar 和 foo/bar 两个包；对于 @foo/bar，我们将尝试读取 @foo/koishi-plugin-bar 和 @foo/bar 两个包）

上面的写法使用 API 可以写成：

```js index.js
app
  .plugin(require('./my-plugin'))
  .plugin(require('@koishijs/plugin-common'), options)
```

### 开发插件

一个**插件**的本质是以下两个之一：

- 一个接受两个参数的函数，第一个参数是所在的上下文，第二个参数是传入的选项
- 一个对象，其中的 `apply` 方法是上面所说的函数

因此，下面的三种写法是等价的：

```js
ctx.middleware(callback)

ctx.plugin(ctx => ctx.middleware(callback))

ctx.plugin({
  apply: ctx => ctx.middleware(callback),
})
```

插件化的写法能够帮助我们将多个逻辑组合在一起并模块化，同时可以在插件内部对所需的选项进行初始化，这些都能极大地提高了代码的可维护性。这是因为每个人都可以直接将代码以插件的形式导出成模块，之后插件名又可以被直接写在 `koishi.config.js` 文件中。

### 具名插件

除此以外，插件如果使用对象式，那么除了 `apply` 以外，你还可以提供一个 `name` 属性。如果提供了这个属性，命令行工具会将这个名字输出到控制台中。例如，下面给出了一个插件的例子，它实现了检测说话带空格的功能：

::: code-group language detect-space
```js
module.exports.name = 'detect-space'

module.exports.apply = (ctx) => {
  ctx.middleware((session, next) => {
    if (session.content.match(/^\s*(\S +){2,}\S\s*$/g)) {
      return session.send('在？为什么说话带空格？')
    } else {
      return next()
    }
  })
}
```
```ts
import { Context } from 'koishi'

export const name = 'detect-space'

export function apply(ctx: Context) {
  ctx.middleware((session, next) => {
    if (session.content.match(/^\s*(\S +){2,}\S\s*$/g)) {
      return session.send('在？为什么说话带空格？')
    } else {
      return next()
    }
  })
}
```
:::

把它放到你的机器人文件夹，接着向你的 `koishi.config.js` 添加一行：

```js koishi.config.js
module.exports = {
  plugins: {
    './detect-space': true,
  },
}
```

调用 `koishi start`，你就可以看到这个插件在正常运行的提示了。

### 嵌套插件

Koishi 的插件也是可以嵌套的。你可以将你编写的插件解耦成多个独立的子插件，再用一个父插件作为入口，就像这样：

```js koishi-plugin-foo/index.js
// 在 a.js, b.js 中编写两个不同的插件
const pluginA = require('./a')
const pluginB = require('./b')

// 将这两个插件输出
module.exports.pluginA = pluginA
module.exports.pluginB = pluginB

// 在 apply 函数中安装 a, b 两个插件
module.exports.apply = (ctx) => {
  ctx.plugin(pluginA)
  ctx.plugin(pluginB)
}
```

这样别人就可以这样使用你的插件了：

```js
// 如果希望同时使用你的插件的全部功能
ctx.plugin(require('koishi-plugin-foo'))

// 如果只希望启用一部分功能
ctx.plugin(require('koishi-plugin-foo').pluginA)

// 或者等价的写法
ctx.plugin(require('koishi-plugin-foo/a'))
```

Koishi 的官方插件 koishi-plugin-common 也使用了 [这种写法](https://github.com/koishijs/koishi/blob/master/packages/plugin-common/src/index.ts)。

### 卸载插件

通常来说一个插件的效应应该是永久的，但如果你想在运行时卸载一个插件，应该怎么做？你可以使用插件定义中的那个上下文的 `dispose` 方法来解决：

::: code-group language my-plugin
```js
module.exports = (ctx, options) => {
  // 编写你的插件逻辑
  ctx.on('message', someListener)
  ctx.command('foo').action(callback)
  ctx.middleware(callback)
  ctx.plugin(require('another-plugin'))

  // 卸载这个插件，取消上面的全部操作
  ctx.dispose()
}
```
```ts
import { Context } from 'koishi'

export default function (ctx: Context, options) {
  // 编写你的插件逻辑
  ctx.on('message', someListener)
  ctx.command('foo').action(callback)
  ctx.middleware(callback)
  ctx.plugin(require('another-plugin'))

  // 卸载这个插件，取消上面的全部操作
  ctx.dispose()
}
```
:::

看起来很神奇，不过它的实现方式也非常简单。当一个插件被注册时，Koishi 会记录注册过程中定义的所有事件钩子、指令、中间件乃至子插件。当 `ctx.dispose()` 被调用时，再逐一取消上述操作的效应。因此，它的局限性也很明显：它并不能妥善处理除了 Context API 以外的**副作用**。不过，我们也准备了额外的解决办法：

::: code-group language my-plugin
```js
module.exports = (ctx, options) => {
  const server = createServer()

  ctx.on('connect', () => {
    // ctx.dispose 无法消除 server.listen 带来的副作用
    server.listen(1234)
  })

  // 添加一个特殊的回调函数来处理副作用
  ctx.before('disconnect', () => {
    server.close()
  })

  // 现在我们又可以愉快地使用 ctx.dispose() 啦
  ctx.dispose()
}
```
```ts
import { Context } from 'koishi'

export default function (ctx: Context, options) {
  const server = createServer()

  ctx.on('connect', () => {
    // ctx.dispose 无法消除 server.listen 带来的副作用
    server.listen(1234)
  })

  // 添加一个特殊的回调函数来处理副作用
  ctx.before('disconnect', () => {
    server.close()
  })

  // 现在我们又可以愉快地使用 ctx.dispose() 啦
  ctx.dispose()
}
```
:::
