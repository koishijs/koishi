---
sidebarDepth: 2
---

# 应用 (App)

**应用 (App)** 是 [Context](./context.md) 的一个子类，它是程序的入口，管理着全部机器人的信息。除了 Context 中已有的属性和方法以外，App 还提供了下面的属性和方法：

## 构造函数选项

通过 `new App(options)` 创建一个 App 实例。

### options.port

- 类型：`number`

服务器监听的端口。

### options.bots

- 类型：`BotOptions[]`

账号相关配置。如果你使用多个账号，这里应该传入一个数组。例如下面的写法是等价的：

```js
new App({ selfId: 123 })

new App({
  bots: [{ selfId: 123 }],
})
```

### options(.bots[]).type

- 类型：`string`

机器人的通信方式，对应你所使用的上游协议，例如 `onebot` 或 `kaiheila` 等。

### options(.bots[]).selfId

- 类型：`number`

机器人自己的 QQ 号。

### options.nickname

- 类型：`string | string[]`

机器人的昵称，可以是字符串或字符串数组。将用于指令前缀的匹配。例如，如果配置该选项为 `'恋恋'`，则你可以通过 `恋恋，help` 来进行 help 指令的调用。参见 [**指令前缀**](../guide/command.md#指令前缀) 一节。

### options.prefix

- 类型：`string | string[]`

指令前缀字符，可以是字符串或字符串数组。将用于指令前缀的匹配。例如，如果配置该选项为 `.`，则你可以通过 `.help` 来进行 help 指令的调用。参见 [**指令前缀**](../guide/command.md#指令前缀) 一节。

### options.delay

- 类型：`DelayOptions`

```js
// 所有配置项的单位均为毫秒
interface DelayOptions {
  // 调用 session.sendQueued() 是消息间发送的最小延迟，按前一条消息的字数计算，默认值为 0
  character?: number
  // 调用 session.sendQueued() 时消息间发送的最小延迟，按固定值计算，默认值为 100
  message?: number
  // 调用 session.cancelQueued() 时默认的延迟，默认值为 0
  cancel?: number
  // 调用 bot.broadcast() 时默认的延迟，默认值为 500
  broadcast?: number
  // 调用 session.prompt() 是默认的等待时间，默认值为 60000
  prompt?: number
}
```

### options.selfUrl

- 类型：`string`

Koishi 服务暴露在公网的地址。部分功能（例如 [adapter-telegram](./adapter/telegram.md) 或是 [plugin-assets](../plugins/other/assets.md)）需要用到。

### options.maxListeners

- 类型：`number`
- 默认值：`64`

每种钩子的最大数量。如果超过这个数量，Koishi 会认定为发生了内存泄漏，将产生一个警告。

### options.autoAuthorize

- 类型：`number | ((session: Session) => number)`
- 默认值：`1`

当获取不到用户数据时默认使用的权限等级。

### options.autoAssign

- 类型：`boolean | ((session: Session) => boolean)`
- 默认值：`true`

当获取不到频道数据时，是否使用接受者作为代理者。

### options.prettyErrors

- 类型：`boolean`

启用报错优化模式。在此模式下 Koishi 会对程序抛出的异常进行整理，过滤掉框架内部的调用记录，输出更易读的提示信息。默认值为 `true`。

### options.minSimilarity

- 类型：`number`

用于模糊匹配的相似系数，应该是一个 0 到 1 之间的数值。数值越高，模糊匹配越严格。设置为 1 可以完全禁用模糊匹配。参见 [**模糊匹配**](../guide/command.md#模糊匹配) 一节。

### options.axiosConfig

- 类型: [`AxiosRequestConfig`](https://github.com/axios/axios#request-config)

用于 axios 请求的配置项。下面是一个利用此配置项设置代理的例子：

```js koishi.config.js
const { SocksProxyAgent } = require('socks-proxy-agent')

module.exports = {
  axiosConfig: {
    httpAgent: new SocksProxyAgent('socks://127.0.0.1:1086'),
    httpsAgent: new SocksProxyAgent('socks://127.0.0.1:1086'),
  },
}
```

## 配置文件选项

下面的配置项来自 koishi 的命令行工具，仅可用于 koishi.config.js。

### options.plugins

- 类型：`Record<string, any> | [string | Plugin, any?][]`

要安装的插件列表。如果传入一个列表，则依次安装列表中的插件；如果传入一个对象，则以对象的键为插件名，值为插件的选项进行安装。参见 [**插件与上下文**](../guide/plugin-and-context.md) 一章。

我们还支持配置插件的上下文选择器：

```js
type SelectorValue = boolean | string | string[]

interface Selection {
  $user: SelectorValue
  $channel: SelectorValue
  $group: SelectorValue
  $private: SelectorValue
  $self: SelectorValue
  $platform: SelectorValue
  $union: Selection[]
  $except: Selection
}
```

参见 [**在配置文件中使用选择器**](../guide/context.md#在配置文件中使用选择器) 一节。

### options.logLevel

- 类型：`number`
- 默认值：`2`

默认的输出等级。参见 [**设置输出等级**](../guide/logger.md#设置输出等级) 一节。

### options.logFilter

- 类型：`Record<string, number>`
- 默认值：`{}`

用于在某些范围覆盖默认的输出等级。参见 [**过滤输出**](../guide/logger.md#过滤输出) 一节。

### options.logTime

- 类型：`string | boolean`
- 默认值：`false`

输出日志所使用的时间格式。参见 [**输出时间**](../guide/logger.md#输出时间) 一节。

### options.logDiff

- 类型：`boolean`
- 默认值：初始未设置，在 connect 事件触发后修改为 `!options.logTime`

是否标注相邻两次输出的时间差。参见 [**输出时间**](../guide/logger.md#输出时间) 一节。

### options.watch

- 类型：[`WatchOptions`](https://github.com/paulmillr/chokidar#api) 外加下面的属性：
  - **watch.root:** `string` 要监听的根目录，相对于工作路径
  - **watch.fullReload:** `boolean` 当检测到非插件变更时，是否重载整个应用

监听文件变化的选项。参见 [**插件热重载**](../guide/cli.md#插件热重载) 一节。

## 实例属性和方法

### app.options

- 类型: `AppOptions`

当前 App 创建时传入的配置。

### app.status

- 类型: `App.Status`

当前 App 的运行状态。它可能是下列数值中的一个：

- Status.closed = 0
- Status.opening = 1
- Status.open = 2
- Status.closing = 3

### app.start()

- 返回值: `Promise<void>`

启动此应用。

### app.stop()

- 返回值: `Promise<void>`

停止此应用。
