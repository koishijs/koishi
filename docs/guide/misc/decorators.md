---
sidebarDepth: 2
---

# 使用装饰器 <Badge text="社区" type="warning"/>

::: danger
请注意：koishi-thirdeye 并不是官方维护的库。如果对这个库的使用或本文档的说明有任何疑问，请前往 [这个仓库](https://github.com/koishijs/koishi-thirdeye) 而非官方仓库提交 issue。
:::

[koishi-thirdeye](https://www.npmjs.com/package/koishi-thirdeye) 允许你使用类装饰器开发 Koishi 插件。下面是一个一目了然的例子：

```ts
import { RegisterSchema, DefinePlugin, SchemaProperty, CommandUsage, PutOption, UseCommand, LifecycleEvents, KoaContext, UseMiddleware, UseEvent, Get } from 'koishi-thirdeye';
import { Context, Session } from 'koishi';

@RegisterSchema()
export class MyPluginConfig {
  @SchemaProperty({ default: 'bar' })
  foo: string;
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
      return 'peng';
    }
    return next();
  }

  // 注册事件监听器
  @UseEvent('message')
  async onMessage(session: Session) {
    if (session.content === 'ping') {
      await session.send('pong');
    }
  }

  // 注册指令
  @UseCommand('echo <content:string>', '指令描述')
  @CommandUsage('指令说明')
  onEcho(
    @PutArg(0) content: string,
    @PutOption('name', '-n <name:string>  指令的参数，名称', { fallback: '有人' }) name: string
  ) {
    return `${name}说了: ${content}`;
  }
}
```

## 定义插件

koishi-thirdeye 允许你使用 `@DefinePlugin()` 装饰器定义类插件。您可以向装饰器中传入插件的基本信息：

- `name` 插件名称
- `schema` 插件的描述配置模式
  - 既可以是传统的 Schema 描述模式，也可以是由 `schemastery-gen` 生成的 Schema 类

```ts
// 在此处定义 Config 的 Schema 描述模式
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin {
  constructor(private ctx: Context, private config: Partial<Config>) {} // 不建议在构造函数进行任何操作
}
```

### 插件基类

为了简化插件的编写，插件基类 `BasePlugin<Config>` 实现了上面的构造函数定义。因此上面的代码可以简化为：

```ts
// 在此处定义 Config 的 Schema 描述模式
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {}
```

在插件内分别可以使用 `this.config` 和 `this.ctx` 访问配置和上下文对象。

## 属性注入

您可以在类成员变量中，使用装饰器进行注入成员变量。

::: warning
注入的变量在构造函数中无法访问。你只能在 `onApply` 等生命周期钩子函数中调用。
:::

```ts
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin {
  constructor(ctx: Context, config: Partial<Config>) {}

  // 建议如此使用 Context，而不是构造函数中的
  @InjectContext()
  private ctx: Context;

  // 建议如此使用 Config，而不是构造函数中的
  @InjectConfig()
  private config: Config;

  // Logger 名称默认为插件名称
  @InjectLogger('my-plugin')
  private logger: Logger;

  // 注入 Service API 中的 Assets，并声明为依赖
  @Inject('assets', true)
  private assets: Assets;

  // 根据属性名称判别 Service API 名称
  @Inject()
  private database: Database;
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

- `onApply` 只能是同步函数，会在插件加载时运行
- `onConnect` 可以是异步函数，会在 Koishi 启动时运行，相当于 ready 事件的回调函数
- `onDisconnect` 可以是异步函数，会在插件被卸载时运行，相当于 dispose 事件的回调函数

## 描述配置模式

借助 schemastery-gen 这个包，我们可以使用装饰器进行编写描述配置模式。插件加载时，类将会自动实例化，并注入这些方法。

我们需要使用 `@DefineSchema` 装饰器对配置类进行修饰，使其成为一个描述配置。同时，需要对每个出现于配置的成员属性使用 `@SchemaProperty` 进行修饰。

对于每一个成员字段，系统将会尝试推断这些字段类型，也可以使用 `type` 参数手动指定类型或另一个 Schema 对象。

特别地，系统可以推断出某一字段是否为数组，但是无法推断数组内部的类型。因此下例中我们**必须**手动指定 `someArray` 的内部类型为 `string`。

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
  someArray: string[]; // 自动推断出 Schema.array(...)，但是无法推断内部类型，需要手动指定
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

// Config 类本身会成为 Schema 对象
@DefineSchema()
export class Config {
  constructor(_config: any) {}

  // 自动推断出 ChildConfig
  @SchemaProperty()
  child: ChildConfig;

  // 无法自动推断 ChildConfig，需要手动指定。但是可以推断出外层的 Schema.array(...)
  @SchemaProperty({ type: ChildConfig })
  children: ChildConfig[];
}
```

## 注册事件

正如最开始的例子一样，我们可以使用以 `Use` 开头的装饰器进行事件和中间件的注册监听。

```ts
import {
  DefinePlugin,
  SchemaProperty,
  CommandUsage,
  PutOption,
  UseCommand,
  OnApply,
  KoaContext,
  UseMiddleware,
  UseEvent,
  Get
} from 'koishi-thirdeye';
import { Context, Session } from 'koishi';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

export class MyPluginConfig {
  @SchemaProperty({ default: 'bar' })
  foo: string;
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
      return 'peng';
    }
    return next();
  }

  // 注册事件监听器
  @UseEvent('message')
  async onMessage(session: Session) {
    if (session.content === 'ping') {
      await session.send('pong');
    }
  }

  // 注册指令
  @UseCommand('echo <content:string>', '指令描述')
  @CommandUsage('指令说明')
  onEcho(
    @PutArg(0) content: string,
    @PutOption('name', '-n <name:string>  指令的参数，名称', { fallback: '有人' }) name: string
  ) {
    return `${name}说了: ${content}`;
  }

  // 注册 Koa 路由
  @Get('/ping')
  onPing(koaCtx: KoaContext) {
    koaCtx.body = 'pong';
  }

  // 注册 WebSocket 监听器
  @Ws('/my-ws')
  onWsClientConnect(socket: WebSocket, req: IncomingMessage) {
    socket.write('Hello!');
    socket.close();
  }
}
```

### 注册装饰器

- `@UseMiddleware(prepend?: boolean)` 注册中间件。等价于 `ctx.middleware(callback, prepend)`。
- `@UseEvent(name: EventName, prepend?: boolean)` 注册事件监听器。等价于 `ctx.on(name, callback, prepend)`。
- `@UseBeforeEvent(name: BeforeEventName, prepend?: boolean)` 注册事件监听器。等价于 `ctx.before(name, callback, prepend)`。
- `@UseCommand(def: string, desc?: string, config?: Command.Config)` 注册指令。
  - 若指定 `config.empty` 则不会注册当前函数为 action，用于没有 action 的父指令。
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
    return 'pong';
  }
  
  @UseCommand('pang', 'Pang!')
  @CommandShortcut('乓！') // 只适用于 pang 指令
  onPang() {
    return 'peng';
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

::: tip
装饰器的执行顺序为由下到上。`@CommandBefore` 会从上到下执行，而 `@CommandAction` 会从下到上执行。而作为类成员方法的回调函数会**最后**执行。
:::

### 指令参数

指令参数也使用一组装饰器对指令参数进行注入。下列装饰器应对由 `@UseCommand` 配置的类成员方法参数进行操作。

- `@PutArgv(field?: keyof Argv)` 注入 `Argv` 对象，或 `Argv` 对象的指定字段。
- `@PutSession(field?: keyof Session)` 注入 `Session` 对象，或 `Session` 对象的指定字段。
- `@PutArg(index: number)` 注入指令的第 n 个参数。
- `@PutArgs()` 注入包含指令全部参数的数组。
- `@PutOption(name: string, desc: string, config: Argv.OptionConfig = {})` 给指令添加选项并注入到该参数。等价于 `cmd.option(name, desc, config)`。
- `@PutUser(fields: string[])` 添加一部分字段用于观测，并将 User 对象注入到该参数。
- `@PutChannel(fields: string[])` 添加一部分字段用于观测，并将 Channel 对象注入到该参数。
- `@PutGuild(fields: string[])` 添加一部分字段用于观测，并将 Guild 对象注入到该参数。
- `@PutUserName(useDatabase: boolean = true)` 注入当前用户的用户名。
  - `useDatabase` 是否尝试从数据库获取用户名。**会自动把 `name` 加入用户观察者属性中**。
- `@PutNext()` 注入 `argv.next` 方法。

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

## 嵌套插件与异步插件

我们可以使用 `@UsePlugin()` 装饰器进行注册子插件。在插件加载时方法会自动被调用。该方法需要返回插件定义，可以使用 `PluginDef()` 方法生成。

成员方法内返回的插件定义可以是同步也可以是异步的。

例如我们需要在插件内加载 `@koishijs/plugin-common` 作为子插件，我们可以用下面的方法。

```ts
import PluginCommon from '@koishijs/plugin-common';
import { DefinePlugin, BasePlugin, UsePlugin, PluginDef } from 'koishi-thirdeye';

@DefinePlugin({ name: 'my-plugin', schema: Config })
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
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  // 类内的 this.context 现在只对 OneBot 平台有效
  @OnGuild()
  @UseEvent('message') // 只对 OneBot 平台的群组有效
  onMessage(session: Session) {
    return;
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

## 声明依赖关系

koishi-thirdeye 支持自动管理插件的关系依赖列表。

### 全局依赖

声明全局依赖有下面几种方法。您也可以把下面几种方法组合使用。

- 使用 `@Inject` 装饰器注入服务对象时，将最后一个参数赋值为 `true`。

```ts
@DefinePlugin({ name: 'my-plugin', schema: Config })
export default class MyPlugin extends BasePlugin<Config> {
  @Inject('database', true)
  private database: Database; // 注入数据库服务，并声明为依赖
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
  private database: Database;
  
  // 该指令仅在数据库被安装时生效
  @UsingService('database')
  @UseCommand('dress', '获取自己的裙子信息')
  async getDresses(@PutSession('userId') userId: string) {
    const dresses = await this.database.get('dress', { userId });
    return dresses.map((dress) => dress.name).join('\n');
  }
}
```

## 提供服务

和 Service 基类不同的是，koishi-thirdeye 使用 `@Provide` 进行提供服务的声明，提供依赖注入 (DI) 风格的 IoC 的开发方式。

若该提供者需要立即生效，我们需要使用 `immediate` 属性，将其标记为立即加载的提供者。

```ts
import { Provide, DefinePlugin, BasePlugin } from 'koishi-thirdeye';

// 类型合并定义不可省略
declare module 'koishi' {
  namespace Context {
    interface Services {
      myService: MyServicePlugin;
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
import { Provide, DefinePlugin, BasePlugin, Caller } from 'koishi-thirdeye';

@Provide('MyPhotoRegistry', { immediate: true })
@DefinePlugin({ name: 'my-photo-registry' })
export class MyPhotoRegistry extends BasePlugin<Config> {
  private photos = new Set<Photo>();
  
  @Caller()
  private caller: Context;
  
  addPhoto(photo: Photo) {
    // 预先保存一下正在访问该方法的上下文，预防以后发生变化。
    const ctx = this.caller;
    
    // 注册来源插件上下文的卸载监听器，使得来源插件卸载时该 Photo 自动被删除。
    ctx.on('dispose', () => this.photos.delete(photo));
    
    this.photos.add(photo);
  }
}
```
