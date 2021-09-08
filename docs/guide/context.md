---
sidebarDepth: 2
---

# 插件与上下文

## 使用插件

Koishi 官方实现了许多功能，但一个机器人很可能只会用到其中的一部分。因此我们采用了插件化的方式，将不同的功能解耦到了不同的包中。你可以在 [官方插件](../plugins/index.md) 中了解到各种不同的功能。

### 安装插件

在之前的文档中，我们已经展示了如何通过配置文件和脚本调用两种方法使用插件，它们的写法略有不同。让我们先回顾一下：

```js koishi.config.js
module.exports = {
  plugins: {
    './my-plugin': true, // true 和 {} 的效果等价
    'common': { /* 传给 koishi-plugin-common 的选项 */ },
  },
}
```

`plugins` 是一个对象，其中的每一个键表示一个插件的路径。

- 如果是一个绝对路径或者相对路径，我们会相对 koishi.config.js 所在的目录进行解析
- 其他情况下我们将其视为包名，并允许省略 koishi-plugin- 这个前缀，并考虑 scope 带来的影响（例如对于 foo/bar，我们将尝试读取 koishi-plugin-foo/bar 和 foo/bar 两个包；对于 @foo/bar，我们将尝试读取 @foo/koishi-plugin-bar 和 @foo/bar 两个包）

上面的写法使用 API 可以写成：

```js index.js
app
  .plugin(require('./my-plugin'))
  .plugin(require('koishi-plugin-common'), options)
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

```js detect-space.js
module.exports.name = 'detect-space'

module.exports.apply = (ctx) => {
  ctx.middleware((meta, next) => {
    if (meta.content.match(/^\s*(\S +){2,}\S\s*$/g)) {
      return meta.send('在？为什么说话带空格？')
    } else {
      return next()
    }
  })
}
```

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

## 使用上下文

一个 **上下文** 描述了机器人的一种可能的运行环境。例如，如果一个指令或中间件被绑定在了上面例子中的上下文，那么只有该环境下的事件才会触发对应的回调函数。之前介绍过的 `ctx.on()`, `ctx.middleware()` 以及 `ctx.plugin()` 这些 API 都是上下文类所提供的方法，而我们能在 `app` 上调用这些方法只是因为 `App` 对象本身也是一个上下文而已。

### 使用选择器

我们可以通过 **选择器** 来快速创建新的上下文：

```js
app.group() // 选择全部群聊会话
app.group.except() // 选择全部私聊会话

app.group('112233') // 选择来自群 112233 的会话
app.group.except('112233') // 选择来自除了群 112233 以外的群的会话

app.user('445566') // 选择来自用户 445566 的会话（包括群聊和私聊）
app.group.except().user('445566') // 选择来自用户 445566 的私聊会话
```

它们实际上是 `ctx.select()` 和 `ctx.unselect()` 方法的语法糖。对于上面的最后一个例子，你可以等价地表示成：

```js
// 选择来自用户 445566 的私聊会话
app.unselect('groupId').select('userId', '445566')
```

利用上下文，你可以非常方便地对每个环境进行分别配置：

```js
// 在所有环境注册中间件
app.middleware(callback)

// 当有人申请加群 112233 时触发 listener
app.group('112233').on('group-request', listener)

// 注册指令 my-command，有数据库支持时才生效
app.select('database').command('my-command')

// 安装插件 ./my-plugin，仅限 OneBot 平台使用
app.select('platform', 'onebot').plugin(require('./my-plugin'))
```

是不是非常方便呢？

### 使用过滤器

你也可以自定义一个上下文的 **过滤器** 函数：它传入一个会话对象，并返回一个 boolean 类型。

```js
// 满足当前上下文条件，且消息内容为“啦啦啦”
ctx.intersect(session => session.content === '啦啦啦')

// 满足当前上下文条件，或消息内容为“啦啦啦”
ctx.union(session => session.content === '啦啦啦')
```

这里的两个方法 `ctx.intersect()` 和 `ctx.union()` 也可以传入一个上下文，表示两个上下文的交集和并集：

```js
// 选择来自用户 445566 的私聊会话
app.unselect('groupId').intersect(app.select('userId', '445566'))

// 选择来自用户 445566 的会话，以及全部私聊会话
app.unselect('groupId').union(app.select('userId', '445566'))
```

这些方法会返回一个新的上下文，在其上使用监听器、中间件、指令或是插件就好像同时在多个上下文中使用一样。

### 在配置文件中使用选择器

如果你使用配置文件，我们也提供了使用选择器的方法：

```js koishi.config.js
export default {
  plugins: {
    common: {
      // 选择器配置
      // 仅在 onebot 平台下 2 个特定频道内注册插件
      $platform: 'onebot',
      $channel: ['123456', '456789'],

      // 其他配置
      onRepeat: {
        minTimes: 3,
        probability: 0.5,
      },
    },
  },
}
```

这相当于

```js
app
  .platform('onebot')
  .channel('123456', '456789')
  .plugin(require('koishi-plugin-common'), {
    onRepeat: {
      minTimes: 3,
      probability: 0.5,
    },
  })
```

当你要使用集合运算的时候，也有对应的语法：

```yaml koishi.config.yml
# 我们也支持 yaml 格式的配置文件
plugins:
  eval:
    # 禁止 discord 平台触发，除非特定调用者在私聊访问
    $union:
      - $private: '123456789'
      - $except:
          $platform: 'discord'
```

这相当于

```js
app
  .private('123456789')
  .union(app.except(app.platform('discord')))
  .plugin(require('koishi-plugin-eval'), {})
```

## 插件热重载

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
Context.delegate('webui')

// 假如你在某个上下文设置了这个值，其他的上下文也将拥有此属性
app.group().webui = new WebUI()
app.private().webui instanceof WebUI // true
```

这个静态方法不仅可以在全体上下文中共享某一个对象，还可以定义具有热重载性质的接口。还记得上面的 `webui.addEntry()` 方法吗？如果我希望当 teach 插件被卸载时，上面注册的 entry 也同时被移除，可以做到吗？这就要用到特殊的 `Context.current` 属性了，它只在被 `Context.delegate()` 声明的类中可用：

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
#### 使用 `Context.delegate()` 时的注意事项

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
