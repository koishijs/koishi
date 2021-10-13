---
sidebarDepth: 2
---

# 发布插件

### 声明依赖关系

当插件数量开始增长，一个新的问题会逐渐浮现：当一个功能依赖多个插件时，它究竟应该属于哪一个？让我们假设你开发了两个插件 webui 和 teach，并且在 teach 中编写了一部分依赖于 webui 的功能。你不希望强迫用户在使用 teach 的时候必须同时安装 webui，因此你使用了这样的写法：

```js plugin-teach.js
module.exports = (ctx) => {
  // 你在这里编写了与 webui 无关的代码，它们才是构成 teach 插件的主体
  ctx.command('teach').action(callback)

  // 让我们假设 webui 插件暴露了一个 ctx.webui 接口
  // 你通过这个接口得以访问 webui 插件，从而实现耦合功能
  if (ctx.webui) {
    ctx.webui.addEntry('/path/to/teach/extension')
  }
}
```

这样写没有任何问题……直到你发现你需要在运行时重载 webui 插件。当你卸载这个插件时，由于上面的代码属于 teach 插件，因此 if 中代码的副作用将无法被有效清理；同时，当重新注册 webui 插件时，这部分的代码也不会被重新运行，从而导致一系列难以检测的问题。

为了解决这种问题，Koishi 提供了一个独特的 `ctx.with()` 方法：

```js plugin-teach.js
module.exports = (ctx) => {
  // 你在这里编写了与 webui 无关的代码，它们才是构成 teach 插件的主体
  ctx.command('teach').action(callback)

  // ctx.with() 的第一个参数是一个数组，表示需要依赖的插件列表
  // 当列表中的所有插件都被注册时，回调函数所代表的插件即被注册
  // 当列表中的任意一个插件被卸载时，回调函数所代表的插件即被卸载
  ctx.with(['webui'], (ctx) => {
    ctx.webui.addEntry('/path/to/teach/extension')
  })
}
```
