---
sidebarDepth: 2
---

# 基本用法

::: warning 注意
由于本插件使用了许多最新的特性，因此需要你的 Node 版本不小于 14.6，并在运行时附上 `--enable-source-maps` 和 `--experimental-vm-modules` 参数。
:::

koishi-plugin-eval 允许用户直接使用机器人执行脚本。它利用了 Node.js 的 vm 和 worker_thread 模块，在保护执行安全的前提下能够获得较快的响应速度。同时，插件还提供了一些内置的 API 供用户调用，结合教学功能可以在客户端实现复杂的行为。

addons 功能在上述功能的基础上，允许用户编写自己的模块并永久保存。插件将自动加载特定目录下的文件，并将其作为机器人的内置功能。用户可以利用此功能存储较为复杂的代码，甚至扩展新的指令。同时，如果上述目录是一个 git 目录，该插件也提供了自动更新等机制。

## 指令：evaluate

## 安全性

### 使用陷阱

koishi-plugin-eval 提供了一套陷阱 API。它会影响 evaluate 指令和扩展指令中的用户数据。你可以通过下面的方式来定义一个陷阱：

```js
const { Trap } = require('koishi-plugin-eval')

Trap.user.define('foo', {
  fields: ['bar'],
  get: user => user.bar,
  set: (user, value) => user.bar = value,
})
```

这样一来，当用户在沙箱中尝试访问 `user.foo` 时，访问到的实际上是 `user.bar` 的数据。

当然，陷阱 API 能做的事远比上面的例子强大。假如一些数据的计算更适合在主线程完成，你就可以通过陷阱来将已经计算好的数据暴露给子线程。

### 禁用部分指令

如果你担心在 evaluate 中调用部分指令存在风险，你可以手动将这些指令设置为禁止在沙箱中调用：

```js
ctx.command('foo', { noEval: true })
```

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">> exec('foo')</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">不能在 evaluate 指令中调用 foo 指令。</chat-message>
</panel-view>

默认情况下，evaluate 指令本身也是禁止在沙箱中调用的。
