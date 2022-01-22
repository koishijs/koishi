---
sidebarDepth: 2
---

# 服务与依赖

在之前的章节中，你或许已经意识到了 Koishi 的大部分特性都是围绕上下文进行设计的——即使不同的上下文可以隶属于不同的插件、配置了不同的过滤器，但许多功能在不同的上下文中访问的效果是一致的。换言之，应用其实可以被理解成一个容器，搭载了各种各样的功能 (如数据库和适配器等)，而上下文则单纯提供了一个接口来访问它们。这种组织形式被称为 **服务 (Service)**。

对于已经有 IoC / DI 概念的同学来说，服务就是一种类似于 IoC 的实现 (但并非通过 DI 实现)。Service API 通过 TypeScript 特有的 **声明合并 (Declaration Merging)** 机制提供了容器内服务的快速访问。

## 服务的类型

Koishi 中的服务可以分为大致三种类型。对于每一种我都给出了一些例子。

第一种是由 Koishi 直接自带的服务。只要有上下文对象，你就可以随时访问这些服务。

- ctx.bots
- ctx.model
- ctx.router

第二种是由 Koishi 所定义但并未实现的服务。你可以选择适当的插件来实现它们。在你安装相应的插件之前，相关的功能是无法访问的。

- ctx.assets
- ctx.cache
- ctx.database

实现特定服务的插件名通常以服务名作为前缀，例如 assets-local, cache-redis, database-mysql 等等。这并非强制的要求，但我们建议插件开发者也都遵循这个规范，这有助于让使用者对你插件的功能建立一个更明确的认识。

最后一种则是由插件定义和实现的服务。通常情况下你需要声明这些服务作为依赖。关于插件与服务的依赖关系，会在下面具体介绍。

- ctx.console
- ctx.puppeteer
- ctx.teach

## 声明依赖关系

前面从服务提供者的角度提供了解决方案，现在让我们把视角转换到服务的使用者上。假设你正在开发名为 teach 的教学系统，并且这个插件依赖多个服务：

- database: 你使用数据库存储教学内容，离开数据库你的插件将无法运行
- assets: 你需要使用资源存储服务来做图片转存，离开此服务将可能导致部分图片无法正常显示，但短时间内不会对插件的运行造成影响
- console: 你为你的插件编写了控制台扩展，当控制台存在时你可以在网页中进行操作，但它并非教学系统的主要功能

那么你应该怎么写呢？先让我们来看一段标准错误答案：

::: code-group language plugin-teach
```js
// 标准错误答案！别抄这个！
module.exports.name = 'teach'

module.exports.apply = (ctx) => {
  // 检查数据库服务是否存在
  if (!ctx.database) return

  ctx.command('teach').action(() => {
    // 检查资源存储服务是否存在
    if (ctx.assets) ctx.assets.transform(content)
  })

  // 检查控制台服务是否存在
  if (ctx.console) {
    ctx.console.addEntry('/path/to/teach/extension')
  }
}
```
```ts
// 标准错误答案！别抄这个！
export const name = 'teach'

export function apply(ctx: Context) {
  // 检查数据库服务是否存在
  if (!ctx.database) return

  ctx.command('teach').action(() => {
    // 检查资源存储服务是否存在
    if (ctx.assets) ctx.assets.transform(content)
  })

  // 检查控制台服务是否存在
  if (ctx.console) {
    ctx.console.addEntry('/path/to/teach/extension')
  }
}
```
:::

你很快会发现这样写完全无法运行。首先，数据库服务需要等到应用启动完成后才可以访问，换言之即使安装了数据库插件，你也无法立即判断数据库服务是否存在。此外，一旦上述服务所在插件在运行时被重载，由于上面的代码属于 teach 插件，因此 if 中代码的副作用将无法被有效清理；而当相应的服务重新被注册时，这部分的代码也不会被重新运行，从而导致一系列难以检测的问题。

### using 属性

为了解决这种问题，Koishi 为插件声明提供了一个独特的 `using` 属性：

::: code-group language plugin-teach
```js
module.exports.name = 'teach'
module.exports.using = ['database']

module.exports.apply = (ctx) => {
  // 你可以立即访问数据库服务
  ctx.database.get()
}
```
```ts
export const name = 'teach'
export const using = ['database'] as const
// 上面的 as const 的作用是固定 `using` 的内部类型

export function apply(ctx: Context) {
  // 你可以立即访问数据库服务
  ctx.database.get()
}
```
:::

`using` 是一个数组，表示此插件依赖的服务列表。如果你声明了某个服务作为你插件的依赖：

- 直到此服务的值变为 truthy 为止，该插件的函数体不会被加载
- 一旦此服务的值发生变化，该插件将立即回滚 (并非插件停用)
- 如果变化后的值依旧为 truthy，该插件会在回滚完成后被重新加载

对于部分功能依赖某个服务的插件，我们也提供了一个语法糖 `ctx.using()`：

```js
ctx.using(['console'], (ctx) => {
  ctx.console.addEntry('/path/to/teach/extension')
})

// 等价于
ctx.plugin({
  using: ['console'],
  apply: (ctx) => {
    ctx.console.addEntry('/path/to/teach/extension')
  },
})
```

::: tip
请务必使用回调函数中的 ctx 而不是外层的 ctx，不然在服务被热重载时可能会引发内存泄漏。
:::

### 最佳实践

现在让我们回到一开始的问题。对于 teach 插件所使用的三个服务 database, assets 和 console，分别应该如何声明呢？下面给出了一个最佳实践，请注意不同服务的处理方式之间的区别：

::: code-group language plugin-teach
```js
// 正确答案！抄这个！
module.exports.name = 'teach'

// 对于整体依赖的服务，使用 using 属性声明依赖关系
module.exports.using = ['database']

module.exports.apply = (ctx) => {
  ctx.command('teach').action(() => {
    // 对于可选的依赖服务，在运行时检测即可
    if (ctx.assets) ctx.assets.transform(content)
  })

  // 对于部分功能依赖的服务，使用 ctx.using() 注册为子插件
  ctx.using(['console'], (ctx) => {
    ctx.console.addEntry('/path/to/teach/extension')
  })
}
```
```ts
// 正确答案！抄这个！
export const name = 'teach'

// 对于整体依赖的服务，使用 using 属性声明依赖关系
export const using = ['database'] as const

export function apply(ctx: Context) {
  ctx.command('teach').action(() => {
    // 对于可选的依赖服务，在运行时检测即可
    if (ctx.assets) ctx.assets.transform(content)
  })

  // 对于部分功能依赖的服务，使用 ctx.using() 注册为子插件
  ctx.using(['console'], (ctx) => {
    ctx.console.addEntry('/path/to/teach/extension')
  })
}
```
:::

## 自定义服务

如果你希望自己插件提供一些接口供其他插件使用，那么最好的办法便是提供自定义服务，就像这样：

```js
// 这个表达式定义了一个名为 console 的服务
Context.service('console')

// 假如你在某个上下文设置了这个值，其他的上下文也将拥有此属性
app.guild().console = new Console()
app.private().console instanceof Console // true
```

这种做法的本质原理是修改了 Context 的原型链。

对于 TypeScript 用户，你还需要进行声明合并，以便能够在上下文对象中获得类型提示：

```ts
declare module 'koishi' {
  namespace Context {
    interface Services {
      console: Console
    }
  }
}
```

### 服务的生命周期

相比直接赋值，我们更推荐你从 Service 派生子类来实现自定义服务：

```js
import { Service } from 'koishi'

class Console extends Service {
  constructor(ctx: Context) {
    // 这样写你就不需要手动给 ctx 赋值了
    super(ctx, 'console', true)
  }
}

// 这样定义的好处在于，Console 本身也是一个插件
app.plugin(Console)
```

Service 抽象类的构造函数支持三个参数：

- ctx: 服务所在的上下文对象
- name: 服务的名称 (即其在所有上下文中的属性名)
- immediate: 是否立即注册到所有上下文中 (可选，默认为 `false`)

以及两个可选的抽象方法：

- start(): 在 ready 事件触发时调用
- stop(): 在 dispose 事件触发时调用

默认情况下，一个自定义服务会先等待 ready 事件触发，然后调用可能存在的 `start()` 方法，最后才会被注册到全体上下文中。这种设计确保了服务在能够被访问的时候就已经是可用的。但如果你的服务不需要等待 ready 事件，那么只需传入第三个参数 `true` 就可以立即将服务注册到所有上下文中。

此外，当注册了服务的插件被卸载时，其注册的服务也会被移除，其他插件不再可以访问到这项服务：

```js
app.console                 // falsy
app.plugin(Console)         // 加载插件
app.console                 // truthy
app.dispose(Console)        // 卸载插件
app.console                 // falsy
app.plugin(Console)         // 重新加载插件
app.console                 // truthy
```

### 支持热重载 <badge text="beta" type="warning"/>

既然服务的作用是提供接口供其他插件调用，就自然会涉及一个热重载的问题。如果某个插件先调用了服务上的方法，然后被卸载，那么我们就需要处理调用所带来的副作用。让我们来看一段 console 插件的源码：
```js
class Console extends Service {
  // 这个方法的作用是添加入口文件
  addEntry(filename: string) {
    this.entries.add(filename)
    this.triggerReload()

    // 注意这个地方的[this.caller]
    this.caller.on('dispose', () => {
      this.entries.delete(filename)
      this.triggerReload()
    })
  }
}
```
在某个插件调用时：
```javascript
module.exports = {
  name: 'some-plugin',
  apply(ctx1) {
    ctx1.using(['console'], (ctx2) => {
    // 上面的[this.caller]对应的上下文是这里的ctx2
    ctx2.console.addEntry('some file')
    })
  }
}
```
`this.caller` 会指向访问此方法的[上下文](./context.md)。只需要在这个上下文上监听 [dispose 事件](./lifecycle.md#dispose-事件)，就可以顺利处理副作用了。
::: tip
需要特别注意：当插件使用 [`ctx.using`](#using-属性) 方法依赖服务时，koishi会为using的回调创建新的[上下文](./context.md)。
:::
你可以一并参考 [上下文](./context.md)，[事件](./lifecycle.md#事件) 以及 [Context API](../../api/core/context.md) 来理解上面的代码。

#### 异步下 `caller` 的表现，以及 当前上下文

`caller` 属性其实是 `this[Context.current]` 的快捷方式，也就是`当前上下文`。而`当前上下文`会随koishi正在处理的上下文变动而指向其他上下文。
 
所以，当你使用 `await` 或 `.then()` 运行异步代码时，`this.caller` 将不再指向`访问此方法的上下文`。

因此，如果你要提供的接口是异步的，并且在后续代码中需要用到`访问此方法的上下文`，那么你需要在执行异步代码前将`当前上下文`保存到其他变量。下面的两种写法都是可以的：

```js
class Console extends Service {
  async addEntry(filename: string) {
    // 预先保存一下 caller，因为后面有异步操作
    const ctx = this.caller
    this.entries.add(filename)
    await this.triggerReload()

    ctx.on('dispose', async () => {
      this.entries.delete(filename)
      await this.triggerReload()
    })
  }
}
```

```js
class Console extends Service {
  async addEntry(filename: string) {
    this.caller.on('dispose', async () => {
      this.entries.delete(filename)
      await this.triggerReload()
    })

    // 或者将异步操作放到后面完成
    this.entries.add(filename)
    await this.triggerReload()
  }
}
```
