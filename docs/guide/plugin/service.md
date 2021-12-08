---
sidebarDepth: 2
---

# 服务与依赖

在之前的章节中，你或许已经意识到了 Koishi 的大部分特性都是围绕上下文进行设计的——即使不同的上下文可以隶属于不同的插件、配置了不同的过滤器，但许多功能在不同的上下文中访问的效果是一致的。换言之，应用其实可以被理解成一个容器，搭载了各种各样的功能 (如数据库和适配器等)，而上下文则单纯提供了一个接口来访问它们。这种组织形式被称为 **服务 (Service)**。

对于已经有 IoC / DI 概念的同学来说，服务就是一种类似于 IoC 的实现 (但并非通过 DI 实现，具体实现方式会在下面介绍)。Service API 通过 TypeScript 特有的依赖合并 (Declaration Merging) 机制提供了容器内服务的快速访问。

## 内置的服务

Koishi 规范化了一系列内置服务。它们可以分为两种类型：

第一种是由 koishi 直接自带的服务。

- ctx.bots
- ctx.http
- ctx.model
- ctx.router

第二种是由 Koishi 所定义但并未实现的服务。你可以选择适当的插件来实现它们。在你安装相应的插件之前，相关的功能是无法正常运行的。

- ctx.assets
- ctx.cache
- ctx.database

**相关的插件名通常以服务名作为前缀**，例如 assets-local, cache-redis, database-mysql 等等。这并非强制的要求，但我们建议插件开发者也都遵循这个规范，这有助于让使用者对你插件的功能建立一个更明确的认识。

## 自定义服务

如果你也想开发出像 @koishijs/plugin-webui 这样的插件，那么你或许也会需要定义一个通用的上下文属性。这非常简单：

```js
// 还是以上面的 webui 为例
Context.service('webui')

// 假如你在某个上下文设置了这个值，其他的上下文也将拥有此属性
app.group().console = new WebUI()
app.private().console instanceof WebUI // true
```

这个静态方法不仅可以在全体上下文中共享某一个对象，还可以定义具有热重载性质的接口。还记得上面的 `webui.addEntry()` 方法吗？如果我希望当 teach 插件被卸载时，上面注册的 entry 也同时被移除，可以做到吗？这就要用到特殊的 `Context.current` 属性了，它只在被 `Context.service()` 声明的类中可用：

```js
class WebUI {
  addEntry(filename) {
    // Context.current 是一个特殊的 symbol，用来标记调用这个方法时所在的上下文
    const ctx = this[Context.current]
    this.entries.add(filename)

    // 当 teach 插件被卸载时，自然会触发 ctx 的 disconnect 事件，这样就实现了无副作用的方法
    ctx.before('disconnect', () => {
      this.entries.delete(filename)
    })
  }
}
```

## 声明依赖关系

当插件数量开始增长，一个新的问题会逐渐浮现：当一个功能依赖多个插件时，它究竟应该属于哪一个？让我们假设你开发了两个插件 webui 和 teach，并且在 teach 中编写了一部分依赖于 webui 的功能。你不希望强迫用户在使用 teach 的时候必须同时安装 webui，因此你使用了这样的写法：

```js plugin-teach.js
module.exports = (ctx) => {
  // 你在这里编写了与 webui 无关的代码，它们才是构成 teach 插件的主体
  ctx.command('teach').action(callback)

  // 让我们假设 webui 插件暴露了一个 ctx.console 接口
  // 你通过这个接口得以访问 webui 插件，从而实现耦合功能
  if (ctx.console) {
    ctx.console.addEntry('/path/to/teach/extension')
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
    ctx.console.addEntry('/path/to/teach/extension')
  })
}
```
