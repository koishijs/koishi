---
sidebarDepth: 2
noTwoslash: true
---

# Nest.js

[Nest.js](https://nestjs.com/) 是一个 IoC 形式的 Node.js Web 应用框架。

[koishi-nestjs](https://www.npmjs.com/package/koishi-nestjs) 允许您在 Nest.js 中，把 Koishi 当作一个模块来引入工程，并与 Nest.js 中的其他模块进行交互，以打造规模化的机器人应用，或在您的业务逻辑中加入机器人功能。

::: tip
本部分文档假定您已经具备 Koishi 和 Nest.js 相关基础。请参照 [Koishi](../../guide/) 以及 [Nest.js](https://docs.nestjs.cn/8/) 的相关文档，了解相关知识。
:::

## 安装

```bash
npm install koishi-nestjs koishi
```

## 配置模块

koishi-nestjs 中，Koishi 以 Nest.js 的模块的形式引入到项目工程中。我们支持同步和异步两种配置方式。

另外，KoishiModule 会被注册为 [全局模块](https://docs.nestjs.cn/8/modules?id=%e5%85%a8%e5%b1%80%e6%a8%a1%e5%9d%97) 。在项目的任何模块中注册 KoishiModule 后，在项目的任何位置均能使用 Koishi 的功能。

### 同步

```ts
import { Module } from '@nestjs/common'
import { KoishiModule, PluginDef } from 'koishi-nestjs'
import PluginOnebot from '@koishijs/plugin-onebot'

@Module({
  imports: [
    KoishiModule.register({
      // 在这里填写 Koishi 配置参数
      prefix: '.',
      usePlugins: [
        // 预安装的插件
        PluginDef(PluginOnebot, {
      	  protocol: 'ws',
          endpoint: 'ws://localhost:6700',
          selfId: '111514',
          token: 'koishi',
        }),
      ],
    }),
  ],
})
export class AppModule {}
```

### 异步

```ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { KoishiModule, PluginDef } from 'koishi-nestjs'
import PluginOnebot from '@koishijs/plugin-adapter-onebot'

@Module({
  imports: [
    KoishiModule.registerAsync({
      imports: [ConfigModule.forRoot()],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        // 在这里填写 Koishi 配置参数
        prefix: '.',
        usePlugins: [
          // 预安装的插件
          PluginDef(PluginOnebot, {
            protocol: 'ws',
            endpoint: config.get('CQ_ENDPOINT'),
            selfId: config.get('CQ_SELFID'),
            token: config.get('CQ_TOKEN'),
          }),
        ],
      }),
    }),
  ],
})
export class AppModule {}
```

### 配置项

koishi-nestjs 的配置项和 [Koishi 配置项](../../api/core/app.md) 基本一致，下面是 koishi-nestjs 特有的配置项：

- `loggerPrefix`: `string` Nest 日志中 Logger 的前缀。默认 `koishi` 。
- `loggerColor`: `number` Nest 日志中 Logger 的颜色支持。默认 `0` 。
- `usePlugins`: `KoishiModulePlugin[]` 可选。预先安装的 Koishi 插件列表。使用 `PluginDef(plugin, options, select)` 方法生成该项的定义。该配置项的成员参数如下。
  - `plugin` Koishi 插件。
  - `options` Koishi 插件配置。等同于 `ctx.plugin(plugin, options)`。
  - `select` 可选，Selection 对象，指定插件的 [上下文选择器](../../guide/plugin/context.md#配置插件上下文) 。
- `moduleSelection` `KoishiModuleSelection[]` 可选。指定 Nest 实例加载的其他 Nest 模块注入的 Koishi 上下文选择器，参数如下：
  - `module` Nest 模块名。
  - `select` Selection 对象，指定插件的 [上下文选择器](../../guide/plugin/context.md#配置插件上下文) 。
- `useWs`: `boolean` 默认 `false` 。是否启用 WebSocket 网关。**异步配置该项应写入异步配置项中**，而不是写在 `useFactory` 中。
- `actionErrorMessage`: `string` 指令中发生未知错误时，机器人返回的信息。默认 `Internal Server Error`。

#### 不支持的配置项

由于 koishi-nestjs 复用了 Nest.js 实例的 HttpServer 对象，因此下列关于 HttpServer 监听的选项将不受支持：

- `port`
- `host`

### WebSocket 服务器

和直接运行 Koishi 不同，Nest.js 中的 Koishi 模块并不会直接注册 HttpServer，而是将 HttpServer 与 Nest.js 中的 HttpServer 进行绑定。而 WebSocket 使用的也是 Nest.js 中的 [WebSocket 网关](https://docs.nestjs.cn/8/websockets) 。因此若要使用到如 `console` 或 `adapter-onebot` 的反向 WebSocket 功能的插件，需要在 Nest.js 实例注册时进行一些额外的配置。

为了与 Koishi 更好地适配 Nest.js 的 WebSocket 功能，koishi-nestjs 提供了基于 `@nestjs/platform-ws` 的专用 Nest.js WebSocket 适配器。我们需要在 Koishi 模块配置中设置 `useWs` 为 `true`，并加载专用 WebSocket 适配器：

```ts
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { KoishiModule, PluginDef } from 'koishi-nestjs'
import PluginOnebot from '@koishijs/plugin-adapter-onebot'

@Module({
  imports: [
    KoishiModule.registerAsync({
      imports: [ConfigModule.forRoot()],
      inject: [ConfigService],
      useWs: true,
      useFactory: async (config: ConfigService) => ({
        // 在这里填写 Koishi 配置参数
        prefix: '.',
        usePlugins: [
          // 预安装的插件
          PluginDef(PluginOnebot, {
            protocol: 'ws',
            endpoint: config.get('CQ_ENDPOINT'),
            selfId: config.get('CQ_SELFID'),
            token: config.get('CQ_TOKEN'),
          }),
        ],
      }),
    }),
  ]
})
export class AppModule {}

// main.ts
const app = await NestFactory.create(AppModule)
app.useWebSocketAdapter(new KoishiWsAdapter(app))
```

该适配器拥有和 `@nestjs/platform-ws` 适配器基本一致的功能。在 Nest.js 工程内您可以如同正常的 WebSocket 适配器一般使用它。

## 注入 Koishi 实例

作为开发方式的一种，您可以在 Nest.js 的控制器或提供者类中直接对 Koishi 实例或上下文进行注入操作。

这种情况下，建议让 Nest 提供者类实现 `OnModuleInit` 接口，并在该事件方法中进行 Koishi 指令注册操作。

koishi-nestjs 将在 Nest.js 应用启动时启动 Koishi 实例。

### 注入上下文

```ts
@Injectable()
export class AppService implements OnModuleInit {
  constructor(@InjectContext() private ctx: Context) {}

  onModuleInit() {
    this.ctx.on('message', (session) => {})
  }
}
```

### 注入某一特定上下文

```ts
@Injectable()
export class AppService implements OnModuleInit {
  constructor(@InjectContextGuild('1111111111') private ctx: Context) {}

  onModuleInit() {
    this.ctx.on('message', (session) => {})
  }
}
```

### 装饰器定义

在 Nest 提供者构造函数参数列表中使用下列装饰器即可进行注入操作。

- `@InjectContext()` 注入全体上下文。等价于 `ctx.any()`
- `@InjectContextPrivate(...values[]: string)` 注入私聊上下文。等价于 `ctx.private(...values)`
- `@InjectContextChannel(...values[]: string)` 注入频道上下文。等价于 `ctx.channel(...values)`
- `@InjectContextGuild(...values[]: string)` 注入群组上下文。等价于 `ctx.guild(...values)`
- `@InjectContextSelf(...values[]: string)` 注入机器人账户上下文。等价于 `ctx.self(...values)`
- `@InjectContextUser(...values[]: string)` 注入用户上下文。等价于 `ctx.user(...values)`
- `@InjectContextPlatform(...values[]: string)` 注入平台上下文。等价于 `ctx.platform(...values)`

### 在自定义提供者注入 Koishi 上下文

您将需要使用函数 `getContextProvideToken()` 进行注入操作，如下例。

```ts
import { Module } from '@nestjs/common'
import { KoishiModule, getContextProvideToken } from 'koishi-nestjs'
import { AppService } from './app.service'
import { Context } from 'koishi'

@Module({
  imports: [
    KoishiModule.register({...})
  ],
  providers: [
    {
      provide: AppService,
      inject: [getContextProvideToken()],
      useFactory: (ctx: Context) => new AppService(ctx)
    }
  ],
})
export class AppModule {}
```

#### 函数定义

```ts
function getContextProvideToken(scopeType?: ContextScopeTypes, values: string[] = [])
```

- `scopeType` 选择器类型，可以是 `private` `channel` `guild` `self` `user` `platform` 之一。留空表示全局上下文。
- `values` 选择器值。例如 `getContextProvideToken('platform', ['onebot'])` 等价于 `ctx.platform('onebot')` .


## 在提供者类中注册方法

您也可以在提供者类中，使用装饰器进行 Koishi 的中间件，事件，指令等方法注册，也可以加载插件。

```ts
@Injectable()
export class AppService {
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
}
```

装饰器定义与 [koishi-thirdeye](./thirdeye.md#注册事件) 中一致。但是下列存在于 koishi-thirdeye 的功能由于 Nest.js 已经提供，因此在 koishi-nestjs 中不受支持。

- `@Get` 等 HTTP 路由注册方法。请使用 Nest.js 的控制器。
- `@Ws` 请使用 Nest.js 的 WebSocket 网关。

### 错误处理

在 koishi-nestjs 的指令处理中，若抛出 Nest.js 中的 `HttpException` 或 `WsException` 的异常时，系统将会以其中的返回信息作为机器人发送给用户的错误信息。

若遇到未知的错误，机器人则会返回给用户 `Internal Server Error` 信息。要改变这一错误信息，可以使用 `actionErrorMessage` 配置选项。设置成空字符串可以完全禁用这一行为。

```ts
@Injectable()
export class AppService {
  @UseCommand('dress', '穿裙子')
  @CommandUsage('今天穿裙子了吗？')
  onDressCommand(
    @PutOption('color', '-c <color:string>  裙子的颜色') color: string,
    @PutUserName() name: string,
  ) {
    throw new NotFoundException(`${name} 今天没有穿裙子！`)
  }
}
```

## 选择器

选择器装饰器可以注册在提供者类顶部，也可以注册在提供者方法函数。定义与 [koishi-thirdeye](./thirdeye.md#选择器) 相同。

具有选择器定义的 Nest.js 提供者类注入的 Koishi 上下文对象，也会受到这些选择器定义的影响。

```ts
@OnPlatform('onebot')
@Injectable()
export class AppService implements OnModuleInit {
  constructor(@InjectContext() private ctx: Context) {}

  onModuleInit() {
    // 只对 OneBot 平台生效
    this.ctx.on('message', (session) => {})
  }
}
```

## 使用服务

您也可以在 Nest.js 的提供者类中，使用 `@WireContextService()` 装饰器在 Nest.js 提供者类中注入 Koishi 的服务对象。

```ts
@Injectable()
export class AppService implements OnApplicationBootstrap {
  // 注入服务对象
  @WireContextService('cache')
  private database: DatabaseService

  // 成员变量名与服务名称一致时 name 可省略。
  @WireContextService()
  private database2: DatabaseService

  async onApplicationBootstrap() {
    // onApplicationBootstrap 钩子方法中，插件已经加载完毕，因此在这里可以确保能访问服务对象
    const user = await this.database.getUser('114514')
  }
}
```
