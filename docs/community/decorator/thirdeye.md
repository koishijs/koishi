---
sidebarDepth: 2
noTwoslash: true
redirectFrom:
  - /guide/misc/decorators.html
---

# 开发插件

[koishi-thirdeye](https://github.com/koishijs/koishi-thirdeye) 允许您使用类装饰器开发 Koishi 插件。下面是一个一目了然的例子：

```ts
import {
  DefinePlugin,
  SchemaProperty,
  PutOption,
  UseCommand,
  OnApply,
  KoaContext,
  UseMiddleware,
  UseEvent,
  Get,
  PutUserName,
  CommandUsage,
} from 'koishi-thirdeye'
import { Context, Session } from 'koishi'
import { WebSocket } from 'ws'
import { IncomingMessage } from 'http'

export class MyPluginConfig {
  @SchemaProperty({ default: 'bar' })
  foo: string
}

@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> implements LifecycleEvents {
  onApply() {
    // 该方法会在插件加载时调用，用于在上下文中注册事件等操作。
  }

  // 注册中间件
  @UseMiddleware()
  simpleMiddleware(session: Session, next: NextFunction) {
    if (session.content === 'pang') {
      return 'peng'
    }
    return next()
  }

  // 注册事件监听器
  @UseEvent('message')
  async onMessage(session: Session) {
    if (session.content === 'ping') {
      await session.send('pong')
    }
  }

  // 注册指令
  @UseCommand('dress', '穿裙子')
  @CommandUsage('今天穿裙子了吗？')
  onDressCommand(
    @PutOption('color', '-c <color:string>  裙子的颜色') color: string,
    @PutUserName() name: string,
  ) {
    return `${name} 今天穿的裙子的颜色是 ${color}。}`
  }

  // 注册 Koa 路由
  @Get('/ping')
  onPing(koaCtx: KoaContext) {
    koaCtx.body = 'pong'
  }

  // 注册 WebSocket 监听器
  @Ws('/my-ws')
  onWsClientConnect(socket: WebSocket, req: IncomingMessage) {
    socket.write('Hello!')
    socket.close()
  }
}
```

## 定义插件

koishi-thirdeye 允许您使用 `@DefinePlugin()` 装饰器定义类插件。您可以向装饰器中传入插件的基本信息：

- **name:** `string` 插件名称。
- **schema:** `Schema` 插件的描述配置模式。既可以是传统的 Schema 描述模式，也可以是由 [schemastery-gen](./schemastery.md) 生成的 Schema 类。

```ts
import { DefineSchema, SchemaProperty, DefinePlugin } from 'koishi-thirdeye'

@DefineSchema()
export class Config {
  @SchemaProperty({ default: 'bar' })
  foo: string
}

@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin {
  constructor(private ctx: Context, private config: Partial<Config>) {} // 不建议在构造函数进行任何操作

  @UseCommand('dress', '穿裙子')
  @CommandUsage('今天穿裙子了吗？')
  onDressCommand(
    @PutOption('color', '-c <color:string>  裙子的颜色') color: string,
    @PutUserName() name: string,
  ) {
    return `${name} 今天穿的裙子的颜色是 ${color}。`
  }
}
```

::: warning
koishi-thirdeye 已经重新导出了 schemastery-gen 这个包。您无需重新安装或导入 schemastery-gen 包。
:::

### 插件基类

为了简化插件的编写，插件基类 `BasePlugin<Config>` 实现了上面的构造函数定义，并定义了一些常用属性。因此上面的代码可以简化为：

```ts
import { DefineSchema, SchemaProperty, DefinePlugin } from 'koishi-thirdeye'

@DefineSchema()
export class Config {
  @SchemaProperty({ default: 'bar' })
  foo: string
}

@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  @UseCommand('dress', '穿裙子')
  @CommandUsage('今天穿裙子了吗？')
  onDressCommand(
    @PutOption('color', '-c <color:string>  裙子的颜色') color: string,
    @PutUserName() name: string,
  ) {
    return `${name} 今天穿的裙子的颜色是 ${color}。`
  }
}
```

在插件内分别可以使用 `this.config` 和 `this.ctx` 访问配置和上下文对象。

## 属性注入

您可以在类成员变量中，使用装饰器进行注入成员变量。

::: warning
注入的变量在构造函数中无法访问。您只能在 `onApply` 等生命周期钩子函数中调用。
:::

```ts
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin {
  constructor(ctx: Context, config: Partial<Config>) {}

  // 建议如此使用 Context，而不是构造函数中的
  @InjectContext()
  private ctx: Context

  // 建议如此使用 Config，而不是构造函数中的
  @InjectConfig()
  private config: Config

  // Logger 名称默认为插件名称
  @InjectLogger('my-plugin')
  private logger: Logger

  // 注入 Service API 中的 Assets，并声明为依赖
  @Inject('assets', true)
  private assets: Assets

  // 根据属性名称判别 Service API 名称
  @Inject()
  private database: DatabaseService
}
```

### API

- `@InjectContext(select?: Selection)` 注入上下文对象。**注入的上下文对象会受全局选择器影响**。
- `@InjectApp()` 注入 Koishi 实例对象。
- `@InjectConfig()` 注入插件配置。
- `@InjectLogger(name: string)` 注入 Koishi 日志记录器。
- `@Inject(name?: string, addUsing?: boolean)` 在插件类某一属性注入特定上下文 Service。`name` 若为空则默认为类方法名。
  - `addUsing` 若为 `true` 则会将该服务声明为本插件的依赖。

## 钩子方法

钩子方法会在特定的时机被调用。要使用钩子方法，只需要实现 `LifecycleEvents` 接口，并定义相应的方法即可。

```ts
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> implements LifecycleEvents {
  // 下列方法只实现需要使用的
  onApply() {}

  async onConnect() {}

  async onDisconnect() {}
}
```

### API

- **onApply:** 只能是同步函数，会在插件加载时运行
- **onConnect:** 可以是异步函数，会在 Koishi 启动时运行，相当于 ready 事件的回调函数
- **onDisconnect:** 可以是异步函数，会在插件被卸载时运行，相当于 dispose 事件的回调函数

## 注册事件

正如最开始的例子一样，我们可以使用以 `Use` 开头的装饰器进行事件和中间件的注册监听。

```ts
import {
  DefinePlugin,
  SchemaProperty,
  PutOption,
  UseCommand,
  OnApply,
  KoaContext,
  UseMiddleware,
  UseEvent,
  Get,
  PutUserName,
  CommandUsage,
} from 'koishi-thirdeye'
import { Context, Session } from 'koishi'
import { WebSocket } from 'ws'
import { IncomingMessage } from 'http'

export class MyPluginConfig {
  @SchemaProperty({ default: 'bar' })
  foo: string
}

@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> implements LifecycleEvents {
  onApply() {
    // 该方法会在插件加载时调用，用于在上下文中注册事件等操作。
  }

  // 注册中间件
  @UseMiddleware()
  simpleMiddleware(session: Session, next: NextFunction) {
    if (session.content === 'pang') {
      return 'peng'
    }
    return next()
  }

  // 注册事件监听器
  @UseEvent('message')
  async onMessage(session: Session) {
    if (session.content === 'ping') {
      await session.send('pong')
    }
  }

  // 注册指令
  @UseCommand('dress', '穿裙子')
  @CommandUsage('今天穿裙子了吗？')
  onDressCommand(
    @PutOption('color', '-c <color:string>  裙子的颜色') color: string,
    @PutUserName() name: string,
  ) {
    return `${name} 今天穿的裙子的颜色是 ${color}。`
  }

  // 注册 Koa 路由
  @Get('/ping')
  onPing(koaCtx: KoaContext) {
    koaCtx.body = 'pong'
  }

  // 注册 WebSocket 监听器
  @Ws('/my-ws')
  onWsClientConnect(socket: WebSocket, req: IncomingMessage) {
    socket.write('Hello!')
    socket.close()
  }
}
```

### 注册装饰器

- `@UseMiddleware(prepend?: boolean)` 注册中间件。等价于 `ctx.middleware(callback, prepend)`。
- `@UseEvent(name: EventName, prepend?: boolean)` 注册事件监听器。等价于 `ctx.on(name, callback, prepend)`。
- `@UseBeforeEvent(name: BeforeEventName, prepend?: boolean)` 注册事件监听器。等价于 `ctx.before(name, callback, prepend)`。
- `@UseCommand(def: string, desc?: string, config?: Command.Config)` 注册指令。
  - 若指定 `config.empty` 则不会注册当前函数为 action，用于没有 action 的父指令。
- `@UseInterval(ms: number)` 注册定时任务，等价于 `ctx.setInterval(callback, ms)`。
- `@Get(path: string)` `@Post(path: string)` 在 Koishi 的 Koa 路由中注册 GET/POST 路径。此外， PUT PATCH DELETE 等方法也有所支持。
- `@Ws(path: string)` 注册 Koishi 的 WebSocket 监听器。

### 指令描述

koishi-thirdeye 使用一组装饰器进行描述指令的行为。这些装饰器需要和 `@UseCommand()` 装饰器一起使用。

特别地，可以把这些装饰器定义在插件顶部，使得该类插件中所有指令均应用这一指令描述。

我们来看一个例子。

```ts
@CommandUsage('乒乓球真好玩！') // 会适用于 ping 和 pang 两个指令
@DefinePlugin()
export default class MyPlugin extends BasePlugin<MyPluginConfig> {
  @UseCommand('ping', 'Ping!')
  @CommandShortcut('枰！') // 只适用于 ping 指令
  onPing() {
    return 'pong'
  }

  @UseCommand('pang', 'Pang!')
  @CommandShortcut('乓！') // 只适用于 pang 指令
  onPang() {
    return 'peng'
  }
}
```

#### API

- `@CommandDescription(text: string)` 指令描述。等价于 `ctx.command(def, desc)` 中的描述。
- `@CommandUsage(text: string)` 指令介绍。等价于 `cmd.usage(text)`。
- `@CommandExample(text: string)` 指令示例。等价于 `cmd.example(text)`。
- `@CommandAlias(def: string)` 指令别名。等价于 `cmd.alias(def)`。
- `@CommandShortcut(def: string, config?: Command.Shortcut)` 指令快捷方式。等价于 `cmd.shortcut(def, config)`。
- `@CommandBefore(callback: Command.Action, append = false)` 等价于 `cmd.before(callback, append)`。
- `@CommandAction(callback: Command.Action, prepend = false)` 等价于 `cmd.action(callback, append)`。
- `@CommandUse(callback, ...args)` 指令功能配置。等价于 `cmd.use(callback, ...args)`。
- `@CommandLocale(locale: string, def: any)` 注册该指令特定语言的 i18n 模板。等价于 `ctx.i18n.define(locale, 'commands.{指令名称}', def)`。

::: tip
装饰器的执行顺序为由下到上。`@CommandBefore` 会从上到下执行，而 `@CommandAction` 会从下到上执行。而作为类成员方法的回调函数会**最后**执行。
:::

### 指令参数

指令参数也使用一组方法参数装饰器对由 `@UseCommand` 定义的类成员方法参数进行注入。此外，部分参数装饰器可以改变指令的行为。

```ts
@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> {
  // 注册指令
  @UseCommand('dress', '穿裙子')
  onDressCommand(
    @PutArg(0) count: number, // 注入该指令的第 1 个参数，并标记该指令的第 1 个参数是 number 类型。
    @PutOption('color', '-c <color>  裙子的颜色') color: string, // 为该方法添加 color 选项，注入到该参数内。
    @PutUserName() name: string, // 注入调用指令的用户的名称。
  ) {
    return `${name} 今天穿了 ${count || 1} 条裙子，颜色是 ${color}。`
  }
}
```

您或许可以注意到，`color` 选项并没有使用 `<color:string>` 这种显式指定选项类型的语法进行定义。但是 koishi-thirdeye 会由 `onDressCommand` 方法参数 `color` 的类型进行推断出 `string` 类型，并写入 `dress` 指令。类似地，`dress` 命令的第一个参数 `[count:number]` 也是自动推断生成的。因此，使用 koishi-thirdeye 编写指令的时候，无需刻意手动指定类型，大部分情况下类型会被自动推断。

#### 类参数

在属性比较多或多个指令的参数存在大量重复的情况下，使用过多方法参数装饰器可能不太优雅。这种情况下您也可以使用类定义指令参数。

```ts
class WearArg {
  @PutArg(0)
  count: number

  @PutOption('color', '-c <color>  颜色')
  color: string

  @PutUserName()
  name: string
}

@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> {
  @UseCommand('dress', '穿裙子')
  onDressCommand(@PutObject() arg: WearArg) {
    return `${arg.name} 今天穿了 ${arg.count || 1} 条裙子，颜色是 ${arg.color}。`
  }

  @UseCommand('sock', '穿袜子')
  onSockCommand(@PutObject() arg: WearArg) {
    return `${arg.name} 今天穿了 ${arg.count || 1} 条袜子，颜色是 ${arg.color}。`
  }
}
```

#### API

这些装饰器可以用于指令对应的类成员方法参数，也可以用于注入类的方法。

- `@PutArgv(field?: keyof Argv)` 注入 `Argv` 对象，或 `Argv` 对象的指定字段。
- `@PutSession(field?: keyof Session)` 注入 `Session` 对象，或 `Session` 对象的指定字段。
- `@PutArg(index: number)` 注入指令的第 n 个参数，从 0 开始。
- `@PutArgs()` 注入包含指令全部参数的数组。
- `@PutOption(name: string, desc: string, config: Argv.OptionConfig = {})` 给指令添加选项并注入到该参数。等价于 `cmd.option(name, desc, config)`。
- `@PutUser(fields: string[])` 添加一部分字段用于观测，并将 User 对象注入到该参数。
- `@PutChannel(fields: string[])` 添加一部分字段用于观测，并将 Channel 对象注入到该参数。
- `@PutGuild(fields: string[])` 添加一部分字段用于观测，并将 Guild 对象注入到该参数。
- `@PutUserName(useDatabase: boolean = true)` 注入当前用户的用户名。
  - `useDatabase` 是否尝试从数据库获取用户名。**会自动把 `name` 加入用户观察者属性中**。
- `@PutNext()` 注入 `argv.next` 方法。
- `@PutRenderer(path: string)` 注入某一特定 i18n 路径的渲染器，类型为 `Renderer<T>`。
- `@PutCommonRenderer()` 注入通用渲染器，类型为 `CRenderer`。
- `@PutObject()` 注入类定义的对象。

### 子指令

koishi-thirdeye 中，子指令需要用完整的名称进行声明。

- 对于没有回调的父指令，可以使用 `empty` 选项，使其不具有 action 字段。

```ts
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  @UseCommand('ygopro', 'YGOPro 相关指令', { empty: true })
  ygoproCommand() {
    // 该指令不会有 action，因此该方法不会被调用。
  }

  @UseCommand('ygopro.rank', 'YGOPro 排名')
  @CommandUsage('查询玩家的 YGOPro 排名')
  ygoproRankCommand(@PutOption('player', '-p <name:string>  玩家名称') player: string) {

  }

  @UseCommand('ygopro.rooms', 'YGOPro 房间')
  @CommandUsage('查询 YGOPro 房间列表')
  ygoproRoomsCommand() {

  }
}
```

## 多语言与模板渲染

koishi-thirdeye 同样也提供了多语言以及模板渲染支持，在指令的类成员方法中使用装饰器即可使用对应的文本。

### 注入渲染器

与传统的 `session.text` 不同，koishi-thirdeye 的指令回调成员函数中采用渲染器注入的方式，将渲染器函数通过方法参数装饰器注入到指令回调函数参数当中进行调用。

#### 注入通用渲染器

您可以使用 `@PutCommonRenderer` 注入通用渲染器，适合需要渲染不确定的文本的场景。

```ts
@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> {
  @UseCommand('foo')
  onFooCommand(
    @PutCommonRenderer() render: CRenderer
  ) {
    // 等价于 session.text('commands.help.description')
    return render('commands.help.description')
  }
}
```

#### 注入指定渲染器

`@PutRenderer` 装饰器可以用来注入某一确定路径的文本的渲染器。特别地，`Renderer<T>` 的类型参数可以锁定该渲染器的传入参数类型，避免开发时的类型出错。

```ts
@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> {
  @UseCommand('dress')
  onNotifyDress(
    @PutRenderer('.notifyWear') render: Renderer<{ name: string }>
  ) {
    return render({ name: 'dress' })
  }
}
```

### 文本定义

koishi-thirdeye 中，定义文本有下面几种形式：

#### 分指令完整定义

对于代码和文本分离的场景，使用 `@CommandLocale(locale: string, def: any)` 也是一个好的选择。

```json
{
  "description": "穿衣服。",
  "options": {
    "name": "穿着的名称。"
  },
  "messages": {
    "notifyWear": "今天穿 {name} 了吗？"
  }
}
```

```ts
@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> {
  @UseCommand('dress')
  @CommandLocale('zh', require('../locales/zh/dress')) // 对应上面的 json 文件。
  @CommandLocale('en', require('../locales/en/dress')) // 略，自行脑补。
  onNotifyDress(
    @PutOption('name', '-n <name:string>') name: string,
    @PutRenderer('.notifyWear') render: Renderer<{ name: string }>
  ) {
    return render({ name })
  }
}
```

#### 完整定义

对于需要集中管理文本的情况，我们也可以利用 `@DefineLocale` 装饰器使用完整定义的方式。

该装饰器需要放在类的顶部，作用等价于 `ctx.i18n.define`，形式相同。

```json
{
  "commands.dress": {
    "description": "穿衣服。",
    "options": {
      "name": "穿着的名称。"
    },
    "messages": {
      "notifyWear": "今天穿 {name} 了吗？"
    }
  }
}
```

```ts
@DefineLocale('zh', require('../locales/zh'))
@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> {
  @UseCommand('dress')
  onNotifyDress(
    @PutOption('name', '-n <name:string>') name: string,
    @PutRenderer('.notifyWear') render: Renderer<{ name: string }>
  ) {
    return render({ name })
  }
}
```

## 嵌套插件与异步插件

我们可以使用 `@UsePlugin()` 装饰器进行注册子插件。在插件加载时方法会自动被调用。该方法需要返回插件定义，可以使用 `PluginDef()` 方法生成。

成员方法内返回的插件定义可以是同步也可以是异步的。

例如我们需要在插件内加载 `@koishijs/plugin-common` 作为子插件，我们可以用下面的方法。

```ts
import PluginCommon from '@koishijs/plugin-common'
import { DefinePlugin, BasePlugin, UsePlugin, PluginDef } from 'koishi-thirdeye'

@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  @UsePlugin()
  registerPluginCommon() { // 会于插件注册时立即运行，并取返回值作为插件的嵌套插件
    return PluginDef(PluginCommon, { echo: true })
  }

  private async getPluginCommonConfig() {
    return { echo: true }
  }

  @UsePlugin()
  async registerAsyncPluginCommon() { // 可以是异步插件
    const pluginCommonConfig = await this.getPluginCommonConfig()
    return PluginDef(PluginCommon, pluginCommonConfig)
  }
}
```

## 选择器

选择器装饰器可以注册在插件类顶部，也可以注册在插件方法函数。

插件类顶部定义的上下文选择器是全局的，会影响使用 `@Inject` 或 `@InjectContext` 注入的任何上下文对象，以及构造函数中传入的上下文对象。

```ts
@OnPlatform('onebot')
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  // 类内的 this.context 现在只对 OneBot 平台有效
  @OnGuild()
  @UseEvent('message') // 只对 OneBot 平台的群组有效
  onMessage(session: Session) {
    return
  }
}
```

### API

- `@OnUser(value)` 等价于 `ctx.user(value)`。
- `@OnSelf(value)` 等价于 `ctx.self(value)`。
- `@OnGuild(value)` 等价于 `ctx.guild(value)`。
- `@OnChannel(value)` 等价于 `ctx.channel(value)`。
- `@OnPlatform(value)` 等价于 `ctx.platform(value)`。
- `@OnPrivate(value)` 等价于 `ctx.private(value)`。
- `@OnSelection(value)` 等价于 `ctx.select(value)`。

## 条件注册

如果某个事件或是子插件只在满足一定条件的情况下进行注册，那么我们可以使用 `@If` 装饰器来指定。

```ts
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  @If<MyPlugin>((o, config, ctx) => o.config.dress) // 只有 config.dress 是 true 的情况下该指令才会注册。
  @UseCommand('dress')
  dressCommand() {
    return '我穿裙子了！'
  }
}
```

### API

`@If<T>(o: T, config: Config, ctx: Context)`

- **o:** 插件实例对象。
- **config:** 插件的配置。
- **ctx:** 插件的上下文对象。

::: tip
由于装饰器无法自动推断类型，因此为了更好地使用该装饰器，您需要如同上例一般，手动指定装饰器的类型 `T` 为插件类本身。
:::

## 声明依赖关系

koishi-thirdeye 支持自动管理插件的关系依赖列表。

### 全局依赖

声明全局依赖有下面几种方法。您也可以把下面几种方法组合使用。

- 使用 `@Inject` 装饰器注入服务对象时，将最后一个参数赋值为 `true`。

```ts
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  @Inject('database', true)
  private database: DatabaseService // 注入数据库服务，并声明为依赖
}

MyPlugin.using // ['database']
```

- 使用 `@UsingService()` 装饰器。

```ts
@UsingService('database', 'assets')
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  // 业务代码
}

MyPlugin.using // ['database', 'assets']
```

### 部分依赖

您也可以使用 `@UsingService()` 装饰器对插件类中某一个方法函数单独声明依赖。这时候该方法注册的注册的中间件、事件监听器、指令等在该类方法绑定的事件只有在该依赖存在时生效。

```ts
@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> {
  @Inject()
  private database: DatabaseService

  // 该指令仅在数据库被安装时生效
  @UsingService('database')
  @UseCommand('dress', '获取自己的裙子信息')
  async getDresses(@PutSession('userId') userId: string) {
    const dresses = await this.database.get('dress', { userId })
    return dresses.map((dress) => dress.name).join('\n')
  }
}
```

## 提供服务

和 Service 基类不同的是，koishi-thirdeye 使用 `@Provide` 进行提供服务的声明，提供依赖注入 (DI) 风格的 IoC 的开发方式。

若该提供者需要立即生效，我们需要使用 `immediate` 属性，将其标记为立即加载的提供者。

```ts
import { Provide, DefinePlugin, BasePlugin } from 'koishi-thirdeye'

// 类型合并定义不可省略
declare module 'koishi' {
  namespace Context {
    interface Services {
      myService: MyServicePlugin
    }
  }
}

@Provide('myService', { immediate: true })
@DefinePlugin({ name: 'my-service' })
export class MyServicePlugin extends BasePlugin<Config> {
  // 该类会作为 Koishi 的 Service 供其他 Koishi 插件进行引用
}
```

::: warning
`@Provide` 装饰器中已经提供了完整的服务提供者的逻辑，因此 `@Provide` 与 Service 基类二者取其一即可。如果您在编写数据库等 Koishi 内置服务的实现，请**不要**使用 `@Provide` 装饰器。
:::

### `@Caller` 装饰器

与 Koishi 的 `Service` 基类的 `caller` 字段对应，我们可以使用 `@Caller` 装饰器修饰的成员变量来获取访问该插件的上下文。

下面是一个例子，确保注册 Photo 的插件卸载时，Photo 正常被删除。

```ts
import { Provide, DefinePlugin, BasePlugin, Caller } from 'koishi-thirdeye'

@Provide('MyPhotoRegistry', { immediate: true })
@DefinePlugin({ name: 'my-photo-registry' })
export class MyPhotoRegistry extends BasePlugin<Config> {
  private photos = new Set<Photo>()

  @Caller()
  private caller: Context

  addPhoto(photo: Photo) {
    // 预先保存一下正在访问该方法的上下文，预防以后发生变化。
    const ctx = this.caller

    // 注册来源插件上下文的卸载监听器，使得来源插件卸载时该 Photo 自动被删除。
    ctx.on('dispose', () => this.photos.delete(photo))

    this.photos.add(photo)
  }
}
```

## 多实例插件

您可能需要开发某一类插件，这些插件的配置中允许定义多个实例，而插件加载时会将每一个对应配置进行实例化，如 [autopic](https://npmjs.com/package/koishi-plugin-autopic) 插件，会定时向特定目标发送随机图片。这些插件的配置看起来像下面的配置，具有 `instances` 属性，配置每一个实例，并在插件加载时分别进行实例化。

我们配置这些插件的时候，会像下面这样书写配置：

```yaml
# koishi.yml
plugins:
  autopic:
    instances:
      - interval: 30000
        tags:
          - 白丝
        targets:
          - bot: 'onebot:1111111111'
            channels:
              - channelId: '123123123'
      - interval: 60000
        tags:
          - 黑丝
        targets:
          - bot: 'onebot:1111111112'
            channels:
              - channelId: '123123123'
```

这样的插件通常情况下，会如同下面的方式进行编写：

```ts
@RegisterSchema()
export class InstanceConfig {
  @SchemaProperty()
  interval: string

  @SchemaProperty({ type: String })
  tags: string[]

  @SchemaProperty({ type: SendTarget })
  targets: SendTarget[]
}

@RegisterSchema()
export class Config {
  instances: Instance[]
}

export class Instance {
  constructor(private ctx: Context, private config: InstanceConfig) {
    ctx.setInterval(() => this.send(), config.interval)
  }

  async send() {
    // 发送图片
  }
}

@DefinePlugin({ schema: Config })
export default class AutoPicPlugin extends BasePlugin<Config> {
  onApply() {
    this.config.instances.forEach((instanceConfig) => new Instance(this.ctx, config))
  }
}
```

更复杂的情况，我们还需要手动实现每个实例的生命周期管理，这会让多实例插件编写变得十分繁琐。因此 koishi-thirdeye 提供了多实例插件的解决方案。

### 编写切面

使用 koishi-thirdeye 编写多实例插件时，您只需要对切面进行编写。编写切面的方式和编写插件的方式相同。

::: warning
切面插件只支持使用 koishi-thirdeye 编写。
:::

```ts
// instance.ts
@RegisterSchema()
export class InstanceConfig {
  @SchemaProperty()
  cron: string

  @SchemaProperty({ type: String })
  tags: string[]

  @SchemaProperty({ type: SendTarget })
  targets: SendTarget[]
}

@DefinePlugin({ schema: InstanceConfig })
export class Instance extends BasePlugin<InstanceConfig> {
  async send() {
    // 发送图片
  }

  onApply() {
    this.ctx.setInterval(() => this.send(), this.config.interval)
  }
}
```

### 定义多实例插件

完成切面编写之后，您只需要使用 `MultiInstancePlugin` 基类工厂函数，即可定义多实例插件。

::: warning
多实例插件的 Schema 描述配置模式已经由 `MultiInstancePlugin` 自动生成，请不要对其进行覆盖，以避免配置异常。
:::

```ts
// index.ts

@DefinePlugin()
export default class AutoPicPlugin extends MultiInstancePlugin(AutoPicInstancePlugin) {}
```

加载多实例插件时，每个实例的配置均在配置的 `instances` 属性下，对应切面插件的配置项。

```yaml
# koishi.yml
plugins:
  autopic:
    instances:
      - interval: 30000
        tags:
          - 白丝
        targets:
          - bot: 'onebot:1111111111'
            channels:
              - channelId: '123123123'
      - interval: 60000
        tags:
          - 黑丝
        targets:
          - bot: 'onebot:1111111112'
            channels:
              - channelId: '123123123'
```

此外，`MultiInstancePlugin` 接受 Schema 描述配置模式类作为第二个参数，允许您对插件的配置进行注入。

::: warning
注入的描述配置模式类只支持使用 [schemastery-gen](./schemastery.md)，即装饰器的形式，进行编写。
:::

```ts
// index.ts
@RegisterSchema()
export class Config {
  @SchemaProperty()
  defaultInterval: number;
}

@DefinePlugin()
export default class AutoPicPlugin extends MultiInstancePlugin(AutoPicInstancePlugin, Config) {}
```

```yaml
# koishi.yml
plugins:
  autopic:
    defaultInterval: 30000
    instances:
      - tags:
          - 白丝
        targets:
          - bot: 'onebot:1111111111'
            channels:
              - channelId: '123123123'
      - interval: 60000
        tags:
          - 黑丝
        targets:
          - bot: 'onebot:1111111112'
            channels:
              - channelId: '123123123'
```

### 实例管理

多实例插件基类提供了 `instances` 属性，可以访问所有加载的实例。

```ts
@DefinePlugin()
export default class AutoPicPlugin extends MultiInstancePlugin(AutoPicInstancePlugin) {
  @UseCommand('instance <name>', '获取实例状态')
  onGetInstanceStatus(@PutArg(0) name: string) {
    const instance = this.instances.find((instance) => instance.name === name)
    if (!instance) {
      return '未找到实例。'
    }
    return instance.getStatus()
  }
}
```

要在切面插件中访问其父插件，可以使用[服务](#提供服务)的形式。

## 扩展数据表

借助 koishi-entities 这个包，您也可以很轻松地使用类和装饰器定义数据表。

::: tip
koishi-thirdeye 已经重新导出了这个包，无需再手动导入或安装 koishi-entities。
:::

### 定义数据表

数据表类以 `@DefineModel` 装饰器进行修饰，指明表的名称。同时，每个表字段以 `@ModelField()` 装饰器进行修饰。

`@ModelField` 的第一个参数用于指定表的类型，用法见 [`ctx.model`](../database/index.md#扩展字段) 的用法。同时，您也可以使用一些其他的相关装饰器自定义表的相关行为。

在数据库查询时，结果中的对象均会被类实例化。因此您可以在类中灵活地定义方法函数，简化数据对象的操作。

```ts
@DefineModel('dress') // 表名称
export class Dress {
  @PrimaryGenerated() // 自增主键
  @ModelField('integer(11)')
  id: number

  @Unique() // 唯一键
  @ModelField()
  name: string

  getDisplayString() {
    return `${this.name}(${this.id})`
  }

  @Foreign('dress', 'id') // 外键，指向 dress.id
  @ModelField('integer(11)')
  parentId: number
}
```

### 注册数据表模型

您只需要使用 `@UseModel` 装饰器修饰插件类即可。

```ts
@UseModel(Dress) // 注册 Dress 数据表模型
@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> {

  // 注入数据库服务，并注册为依赖
  @Inject(true)
  private database: DatabaseService

  @UseCommand('dress <id>')
  async getDress(@PutArg(0) id: number) {
    const [dress] = await this.database.get(dress, { id })
    if (dress) {
      return dress.getDisplayString() // 可以使用对象方法
    } else {
      return 'Not found.'
    }
  }
}
```

### 扩展内置数据表

对于 `user` 或 `channel` 等内置数据表，以及来自其他插件的表，比起重新定义整个表模型，更常见的场景是需要在表内添加若干字段。这种情况下 `@MixinModel` 可能为适合。

```ts
declare module 'koishi' {
  interface User {
    dress: Dress;
  }
}

// 无需 @DefineModel 装饰器
class Dress {
  @ModelField('string(8)')
  color: string
  @ModelField('integer(7)')
  size: string
  getDisplayString() {
    return `${this.color} dress of size ${this.id}`
  }
}

@MixinModel('user', { dress: Dress }) // 将 Dress 类成员字段作为 dress 属性注入到 user 表中
@DefinePlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> {

  @UseCommand('mydress')
  getDress(@PutUser(['name', 'dress']) user: User) {
    return `${user.name} is wearing a ${user.dress.getDisplayString()}.`
  }
}
```
