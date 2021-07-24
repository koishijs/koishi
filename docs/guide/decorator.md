---
sidebarDepth: 2
---

# 使用装饰器 <Badge text="beta" type="warning"/>

koishi-dev-utils 允许你使用装饰器开发 Koishi 插件。下面是一个最简单的例子：

```ts
import { Plugin, PluginContext } from 'koishi-dev-utils'

@Plugin('decorator-example')
class MyPlugin extends PluginContext {
  @Middleware()
  hello(session, next) {
    return session.send('hello')
  }

  @Command('echo')
  echo(_, text) {
    return text
  }
}

export = new MyPlugin()
```

它等价于下面的代码：

```ts
import { Context } from 'koishi-core'

export const name = 'decorator-example'

export function apply(ctx: Context) {
  ctx.middleware((session, next) => {
    return session.send('hello')
  })

  ctx.command('echo').action((_, text) => {
    return text
  })
}
```

## 插件上下文

在上面的例子中，我们使用 `PluginContext` 作为插件的基类。在这个类中你可以直接使用 `this` 作为插件的上下文；同时这个类的实例也正好是一个合法的插件。

特别地，插件上下文还允许带有一个类型参数，作为插件的配置项。你可以使用 `this.config` 访问到它：

```ts
interface Config {
  text: string
}

@Plugin('welcome')
class WelcomePlugin extends PluginContext<Config> {
  @Event('group-member-added')
  welcome(session) {
    session.send(this.config.text)
  }
}

app.plugin(new WelcomePlugin(), { text: '欢迎新人' })
```

除去中间件、指令和事件以外，如果有其他需求也可以直接通过 `@Apply` 实现：

```ts
@Plugin()
class ApplyPlugin extends PluginContext {
  @Apply
  someWorks() {
    // 比如这里还可以注册其他插件
    this.plugin(new WelcomePlugin())
  }

  @Apply
  otherWorks() {
    // 你可以写多个 @Apply 方法，它们都会被按顺序执行
  }
}
```

## 使用选择器

你也可以在插件上下文中使用选择器：

```ts
@Plugin()
class SelectorPlugin extends PluginContext {
  @User('123')
  @Middleware()
  callback1() {}

  @Select('database')
  @Command()
  callback2() {}

  @Channel.Except('456', '789')
  @Apply
  callback3() {}
}
```

这里的每一个回调函数都有独立的上下文选择器，相当于下面的代码：

```ts
function apply(ctx) {
  const ctx1 = ctx.user('123')
  ctx1.middleware(callback1.bind(ctx1))

  const ctx2 = ctx.select('database')
  ctx2.command().action(callback2.bind(ctx2))

  callback3.call(ctx.channel.except('456', '789'))
}
```
