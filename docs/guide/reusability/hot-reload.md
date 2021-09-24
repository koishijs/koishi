---
sidebarDepth: 2
---

# 插件热重载

::: tip
本节包含了较为进阶的知识。如果你是 Koishi 的初学者，我们建议暂时跳过这部分的内容。当你已经熟悉插件的使用逻辑时，再回来看看，或许能有一些突破。
:::

### 卸载插件

通常来说一个插件的效应应该是永久的，但如果你想在运行时卸载一个插件，应该怎么做？你可以使用插件定义中的那个上下文的 `dispose` 方法来解决：

```js my-plugin.js
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

看起来很神奇，不过它的实现方式也非常简单。当一个插件被注册时，Koishi 会记录注册过程中定义的所有事件钩子、指令、中间件乃至子插件。当 `ctx.dispose()` 被调用时，再逐一取消上述操作的效应。因此，它的局限性也很明显：它并不能妥善处理除了 Context API 以外的**副作用**。不过，我们也准备了额外的解决办法：

```js my-plugin.js
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

### 声明副作用

在两种情况下一个上下文是禁止卸载的：

- 这个上下文注册了 before-connect 钩子
- 这个上下文所在的插件显式的声明了自己的副作用

在这两种情况下，调用 `ctx.dispose()` 将会抛出一个错误。同时 watch 或者 webui 中的可重载特性也将被禁用。如果你确实不希望一个插件被重载，或者这个插件确实存在一些不好处理的副作用，那么可以显式地声明这个副作用，与你声明这个插件的名称放在一起：

```js my-plugin.js
module.exports.name = 'my-plugin'
module.exports.sideEffect = true

module.exports.apply = (ctx) => {
  // do something with side effect
}
```

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
  ctx.with(['koishi-plugin-webui'], (ctx) => {
    ctx.webui.addEntry('/path/to/teach/extension')
  })
}
```

### 声明通用上下文属性 <Badge text="beta" type="warning"/>

事实上，当你了解了更多接口之后，你就会发现 Context 对象上的一些属性对所有上下文都是一样的，比如 `ctx.database`, `ctx.router` 以及上面的例子中提到的 `ctx.webui` 等等。如果你也想开发出像 koishi-plugin-webui 这样的插件，那么你或许也会需要定义一个通用的上下文属性。这非常简单：

```js
// 还是以上面的 webui 为例
Context.service('webui')

// 假如你在某个上下文设置了这个值，其他的上下文也将拥有此属性
app.group().webui = new WebUI()
app.private().webui instanceof WebUI // true
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

::: warning
#### 使用 `Context.service()` 时的注意事项

由于你访问一个通用属性实际上获得的是以该属性原始值为原型的新对象，因此你需要格外警惕对原始对象上属性的修改。下面是一个**错误的实例**：

```js
class WebUI {
  myMethod() {
    this.foo = 'bar'
  }
}

app.webui = new WebUI()
app.webui.myMethod()
app.webui.foo // undefined
```

正确的写法是使用箭头函数代替：

```js
class WebUI {
  myMethod = () => {
    this.foo = 'bar'
  }
}

app.webui = new WebUI()
app.webui.myMethod()
app.webui.foo // 'bar'
```

但另一方面，如果你要使用 `Context.current`，那你只能使用成员函数，箭头函数中的 this 指向的是原始对象，也是不管用的。如果你既要修改原始对象上的属性，又要支持热重载，那么最好的办法就是定义两个方法，一个负责修改原始对象，而另一个负责处理热重载逻辑。
:::
