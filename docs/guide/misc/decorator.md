---
sidebarDepth: 2
---

# 使用装饰器 <Badge text="beta" type="warning"/>

::: danger 注意
这里是**正在施工**的 koishi v4 的文档。要查看 v3 版本的文档，请前往[**这里**](/)。
:::

koishi-thirdeye 允许你使用类装饰器开发 Koishi 插件。下面是一个最简单的例子：

```ts
import { KoishiPlugin, SchemaProperty, CommandUsage, PutOption, UseCommand, OnApply, KoaContext, UseMiddleware, UseEvent, Get } from 'koishi-thirdeye';
import { Context, Session } from 'koishi';

export class MyPluginConfig {
  @SchemaProperty({ default: 'bar' })
  foo: string;
}

@KoishiPlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> implements OnApply {
  onApply() {
    // 该方法会在插件加载时调用，用于在上下文中注册事件等操作。
  }

  @UseMiddleware()
  simpleMiddleware(session: Session, next: NextFunction) {
    return next();
  }

  @UseEvent('message')
  onMessage(session: Session) {

  }

  @UseCommand('echo', '命令描述')
  @CommandUsage('命令说明')
  onEcho(@PutOption('content', '-c <content:string>  命令参数') content: string) {
    return content;
  }

  @Get('/ping')
  onPing(ctx: KoaContext) {
    ctx.body = 'pong';
  }
}
```

## 定义插件

使用 koishi-thirdeye 的插件必须是类插件，且使用 `@KoishiPlugin(options: KoishiPluginRegistrationOptions)` 装饰器。

您可以在参数中指定该插件的基本信息，初夏：

* `name` 插件名称。

* `schema` 插件的配置描述模式。可以是一般的 Schema 描述模式，也可以是由 `schemastery-gen` 生成的 Schema 类。下面我们会对此进行叙述。

```ts
// 在此处定义 Config 的 Schema 描述模式

@KoishiPlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin {
  constructor(private ctx: Context, private config: Partial<Config>) {} // 不建议在构造函数进行任何操作
}
```

### 插件基类

为了简化插件的半歇，插件基类 `BasePlugin<Config>` 实现了上面的构造函数定义。因此上面的代码可以简化为：

> `@KoishiPlugin` 装饰器不可省略。

```ts
// 在此处定义 Config 的 Schema 描述模式

@KoishiPlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {}
```

在插件内分别可以使用 `this.config` `this.ctx` 访问配置和上下文对象。

## 属性注入

您可以在类成员变量中，使用装饰器进行注入成员变量。 **注入的变量在构造函数中无效。** 请在 `onApply` 等生命周期钩子函数中调用。

> 请不要在构造函数中进行对这些字段对访问。

```ts
@KoishiPlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin {
  constructor(ctx: Context, config: Partial<Config>) {}
  
  @InjectContext()
  private ctx: Context; // 建议如此使用 Context，而不是构造函数中的

  @InjectConfig()
  private config: Config; // 建议如此使用 Config，而不是构造函数中的

  @InjectLogger('my-plugin') // Logger 名称默认为插件名称
  private logger: Logger;

  @Inject('cache', true)
  private cache: Cache; // 注入 Service API 中的 Cache，并加入 using 列表

  @Inject()
  private database: Database; // 根据属性名称判别 Service API 名称
}
```

### API

* `@InjectContext(select?: Selection)` 注入上下文对象。 **注入的上下文对象会受全局选择器影响。**

* `@InjectApp()` 注入 Koishi 实例对象。

* `@InjectConfig()` 注入插件配置。

* `@InjectLogger(name: string)` 注入 Koishi 日志记录器。

* `@Inject(name?: string, addUsing?: boolean)` 在插件类某一属性注入特定上下文 Service 。 `name` 若为空则默认为类方法名。

  * `addUsing` 若为 `true` 则会为插件注册的 Service 。

## 钩子方法

钩子方法会在特定的时机被调用。要使用钩子方法，只需要实现对应的接口，并编写相应的方法即可。

```ts
@KoishiPlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> implements OnApply, OnConnect, OnDisconnect { // 实现对应的钩子方法即可
  
  onApply() {}

  async onConnect() {}

  async onDisconnect() {}
}
```

### API

* `onApply` 只能是同步函数，会在插件加载时运行。

* `onConnect` 可以是异步函数，会在 Koishi 启动时运行。等价于 `ctx.on('ready', async () => {})`

* `onDisconnect` 可以是异步函数，会在插件被卸载时运行。等价于 `ctx.on('dispose', async () => {})`

## 配置描述模式

借助 schemastery-gen 这个包，我们可以使用装饰器进行编写配置描述模式。插件加载时，类将会自动实例化，并注入这些方法。

我们需要使用 `@DefineSchema` 装饰器对配置类进行修饰，使其成为一个配置描述。同时，需要对每个出现于配置的成员属性使用 `@SchemaProperty` 进行修饰。

对于每一个成员字段，系统将会尝试推断这些字段类型，也可以使用 `type` 参数手动指定类型或另一个 Schema 对象。

特别的，系统可以推断出某一字段是否为数组，但是无法推断数组内部的类型。因此下例中我们**必须**手动指定 `someArray` 的内部类型为 `string` 。

```ts
@DefineSchema() // Config 类本身会成为 Schema 对象
export class Config {
  constructor(_config: any) {}

  @SchemaProperty({ default: 'baz' })
  foo: string; // 自动推断出 Schema.string()

  getFoo() {
    return this.foo;
  }

  @SchemaProperty({ type: Schema.number(), required: true }) // 也可手动指定 Schema 对象
  bar: number;

  @SchemaProperty({ type: String })
  someArray: string[]; // 自动推断出 Schema.array(...)，但是无法推断内部类型，需要手动指定。
}
```

### 嵌套配置

在配置类存在嵌套的情况下，内层类也会自动实例化，并且会自动注入到外层类的对应属性中。

```ts
@DefineSchema()
export class ChildConfig {
  constructor(_config: any) {}

  @SchemaProperty({ default: 'baz' })
  foo: string;

  @SchemaProperty({ type: Schema.number(), required: true })
  bar: number;
}

@DefineSchema() // Config 类本身会成为 Schema 对象
export class Config {
  constructor(_config: any) {}

  @SchemaProperty()
  child: ChildConfig; // 自动推断出 ChildConfig

  @SchemaProperty({ type: ChildConfig })
  children: ChildConfig[]; // 无法自动推断 ChildConfig，需要手动指定。但是可以推断出外层的 Schema.array(...)
}
```

## 注册事件

正如最开始的例子一样，我们可以使用以 `Use` 开头的装饰器进行事件和中间件的注册监听。

```ts
import { KoishiPlugin, SchemaProperty, CommandUsage, PutOption, UseCommand, OnApply, KoaContext, UseMiddleware, UseEvent, Get } from 'koishi-thirdeye';
import { Context, Session } from 'koishi';

export class MyPluginConfig {
  @SchemaProperty({ default: 'bar' })
  foo: string;
}

@KoishiPlugin({ name: 'my-plugin', schema: MyPluginConfig })
export default class MyPlugin extends BasePlugin<MyPluginConfig> implements OnApply {
  onApply() {
    // 该方法会在插件加载时调用，用于在上下文中注册事件等操作。
  }

  @UseMiddleware()
  simpleMiddleware(session: Session, next: NextFunction) {
    return next();
  }

  @UseEvent('message')
  onMessage(session: Session.Payload<'message'>) {

  }

  @UseCommand('echo', '命令描述')
  @CommandUsage('命令说明')
  onEcho(@PutOption('content', '-c <content:string>  命令参数') content: string) {
    return content;
  }

  @Get('/ping')
  onPing(ctx: KoaContext) {
    ctx.body = 'pong';
  }
}
```

### 注册装饰器

* `@UseMiddleware(prepend?: boolean)` 注册中间件，等价于 `ctx.middleware((session, next) => { }, prepend)`。

* `@UseEvent(name: EventName, prepend?: boolean)` 注册事件监听器。等价于 `ctx.on(name, (session) => { }, prepend)`。
* 
* `@UseBeforeEvent(name: BeforeEventName, prepend?: boolean)` 注册事件监听器。等价于 `ctx.before(name, (session) => { }, prepend)`。

* `@UseCommand(def: string, desc?: string, config?: Command.Config)` 注册指令。

  * 若指定 `config.empty` 则不会注册当前函数为 action，用于没有 action 的父指令。

* `@Get(path: string)` `@Post(path: string)` 在 Koishi 的 Koa 路由中注册 GET/POST 路径。此外， PUT PATCH DELETE 等方法也有所支持。

### 指令描述装饰器

koishi-thirdeye 使用一组装饰器进行描述指令的行为。这些装饰器需要和 `@UseCommand(def)` 装饰器一起使用。

* `@CommandDescription(text: string)` 指令描述。等价于 `ctx.command(def, desc)` 中的描述。

* `@CommandUsage(text: string)` 指令介绍。等价于 `cmd.usage(text)`。

* `@CommandExample(text: string)` 指令示例。等价于 `cmd.example(text)`。

* `@CommandAlias(def: string)` 指令别名。等价于 `cmd.alias(def)`。

* `@CommandShortcut(def: string, config?: Command.Shortcut)` 指令快捷方式。等价于 `cmd.shortcut(def, config)`。

### 指令参数

指令参数也使用一组装饰器对指令参数进行注入。下列装饰器应对由 `@UseCommand` 配置的类成员方法参数进行操作。

* `@PutArgv()` 注入 `Argv` 对象。

* `@PutSession(field?: keyof Session)` 注入 `Session` 对象，或 `Session` 对象的指定字段。

* `@PutArg(index: number)` 注入指令的第 n 个参数。

* `@PutOption(name: string, desc: string, config: Argv.OptionConfig = {})` 给指令添加选项并注入到该参数。等价于 `cmd.option(name, desc, config)` 。

* `@PutUser(fields: string[])` 添加一部分字段用于观测，并将 User 对象注入到该参数。

* `@PutChannel(fields: string[])` 添加一部分字段用于观测，并将 Channel 对象注入到该参数。

* `@PutUserName(useDatabase: boolean = true)` 注入当前用户的用户名。
  * `useDatabase` 是否尝试从数据库获取用户名。**会自动把 `name` 加入用户观察者属性中。**

### 子指令

koishi-thirdeye 中，子指令需要用完整的名称进行声明。

* 对于没有回调的父指令，可以使用 `empty` 选项，使其不具有 action 字段。

```ts
@KoishiPlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  @UseCommand('ygopro', 'YGOPro 相关指令', { empty: true })
  ygoproCommand() {
    // 该命令不会有 action，因此该方法不会被调用。
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

## 嵌套插件与异步插件

我们可以使用 `@UsePlugin()` 装饰器进行注册子插件。在插件加载时方法会自动被调用。该方法需要返回插件定义，可以使用 `PluginDef(plugin, options)` 方法生成。

成员方法内返回的插件定义可以是同步也可以是异步的。

例如我们需要在插件内加载 `@koishijs/plugin-common` 作为子插件，我们可以用下面的方法。

```ts
import PluginCommon from '@koishijs/plugin-common';
import { KoishiPlugin, BasePlugin, UsePlugin, PluginDef } from 'koishi-thirdeye';

@KoishiPlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  @UsePlugin()
  registerPluginCommon() { // 会于插件注册时立即运行，并取返回值作为插件的嵌套插件
    return PluginDef(PluginCommon, { echo: true })
  }

  private async getPluginCommonConfig() {
    return { echo: true };
  }

  @UsePlugin()
  async registerAsyncPluginCommon() { // 可以是异步插件
    const pluginCommonConfig = await this.getPluginCommonConfig();
    return PluginDef(PluginCommon, pluginCommonConfig);
  }
}
```

## 选择器

选择器装饰器可以注册在插件类顶部，也可以注册在插件方法函数。

插件类顶部定义的上下文选择器是全局的，会影响使用 `@Inject` 或 `@InjectContext` 注入的任何上下文对象，以及构造函数中传入的上下文对象。

```ts
@OnPlatform('onebot')
@KoishiPlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  // 类内的 this.context 现在只对 OneBot 平台有效
  
  @OnGuild()
  @UseEvent('message') // 只对 OneBot 平台的群组有效
  onMessage(session: Session.Payload<'message'>) {
    return;
  }
}
```

### API

* `@OnUser(value)` 等价于 `ctx.user(value)`。

* `@OnSelf(value)` 等价于 `ctx.self(value)`。

* `@OnGuild(value)` 等价于 `ctx.guild(value)`。

* `@OnChannel(value)` 等价于 `ctx.channel(value)`。

* `@OnPlatform(value)` 等价于 `ctx.platform(value)`。

* `@OnPrivate(value)` 等价于 `ctx.private(value)`。

* `@OnSelection(value)` 等价于 `ctx.select(value)`。

## Service API 提供者

和 Service 基类不同的是，koishi-thirdeye 使用 `@Provide` 进行 Service API 提供者声明，提供依赖注入 (DI) 风格的 IoC 的开发方式。

`@Provide` 调用时会自动完成 `Context.service(serviceName)` 的声明，因此无需再额外使用 `Context.service` 进行声明 Service API 提供者。但是仍要进行类型合并定义。

若该提供者需要立即生效，我们需要使用 `immediate` 属性，将其标记为立即加载的提供者。

```ts
import { Provide, KoishiPlugin, BasePlugin } from 'koishi-thirdeye';

// 类型合并定义不可省略
declare module 'koishi' {
  namespace Context {
    interface Services {
      myService: MyServicePlugin;
    }
  }
}

// `@Provide(name)` 装饰器会自动完成 `Context.service(name)` 的声明操作
@Provide('myService', { immediate: true })
@KoishiPlugin({ name: 'my-service' })
export class MyServicePlugin extends BasePlugin<Config> {
  // 该类会作为 Koishi 的 Service 供其他 Koishi 插件进行引用
}
```
