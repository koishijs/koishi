---
sidebarDepth: 2
---

# 输出与日志

::: danger 注意
这里是**正在施工**的 koishi v4 的文档。要查看 v3 版本的文档，请前往[**这里**](/)。
:::

本章主要介绍如何控制 Koishi 命令行工具的输出。

## 配置输出

### 控制输出等级

**输出等级**控制了所有输出到命令行的内容的重要性。在 Koishi 内置的输出系统中，所有信息被分为了 3 种不同的等级：

1. error, success
2. warning, info
3. debug

相应地，当设置输出等级为 x 时，Koishi 只会输出重要性小于等于 x 的信息。当输出等级被设置为 0 时，Koishi 将不产生任何输出；而当输出等级被设置为 3 时，Koishi 产生的全部信息都会被显示在屏幕上（当然下面还会介绍过滤器，你可以通过手动设置过滤器减少输出。）

需要注意的是，运行时产生的错误（如请求失败，数据库访问失败等）都属于 warning，只有在创建阶段和连接阶段抛出的错误才会通过 error 输出（参见 [生命周期](./lifecycle.md#生命周期)）。

默认情况下 Koishi 的输出等级为 2。同时你有多种方法修改这个值。

你可以在配置文件中控制输出等级：

```js title=koishi.js
module.exports = {
  logLevel: 3,
}
```

在使用 `koishi start` 指令时，你也可以加入一个 `--log-level` 选项，它的值可以是 0~3 之间的一个整数，表示不同的输出等级。例如，`--log-level=0` 就表示不产生任何输出。

上述两种方法的功能类似，但是 CLI 选项将具有更高的优先级，这样允许你临时覆盖一些配置。

### 在日志中显示时间

如果你希望在每行输出前打印当前的时间，可以使用配置项 `logTime` 或者命令行选项 `--log-time`。这个选项既可以单纯地配置，也可以传入一个字符串作为输出时间的格式。基本语法如下：

- yyyy: 四位数年份
- yy: 年份末两位
- MM: 两位数月份
- dd: 两位数日期
- hh: 两位数小时
- mm: 两位数分钟
- ss: 两位数秒
- SSS: 三位数毫秒

当配置为 `true` 时，这一项时的默认格式为 `yyyy/MM/dd hh:mm:ss`。

## 命名空间

### 在插件中输出

如果你是插件开发者，你也可以主动调用 Koishi 内置的 Logger API 来输出调试信息，这样用户就可以用上述的方法来控制你的插件的输出等级了。具体使用方法是这样的：

```js title=my-plugin.js
module.exports = (ctx) => {
  // 生成一个 Logger 对象，foo 作为它的命名空间
  const logger = ctx.logger('foo')

  doSomething()
    // 调用 logger 方法来产生输出
    .then(() => logger.success('hello'))
    .catch(() => logger.warn('failed'))
}
```

上面的这个 Logger 对象有下面的方法，它们的函数签名与 `console.log` 一致：

```ts no-extra-header
export interface Logger {
  warn(format: any, ...param: any[]): void
  info(format: any, ...param: any[]): void
  debug(format: any, ...param: any[]): void
  success(format: any, ...param: any[]): void
  error(format: any, ...param: any[]): void
}
```

### 过滤命名空间

前面所说的命名空间不仅会作为输出的前缀，还能用于过滤输出。用户可以通过将 `logLevel` 配置成对象的形式，指定每一个插件产生的输出的等级，就像这样：

```js title=koishi.js
module.exports = {
  logLevel: {
    // 基础输出等级，当没有找到对应的配置项时将使用这个值
    // 如果配置了 koishi start --log-level，将覆盖这个值
    base: 3,
    // 过滤掉所有等级大于 2 的来自命名空间 foo 的输出
    foo: 2,
  },
}
```

Koishi 也支持多级命名空间，每一级之间用冒号分隔，你可以用下面的方式声明一个子命名空间：

```js title=plugin-foo.js
module.exports = (ctx) => {
  // 这两种写法是等价的
  const logger = ctx.logger('foo:temp')
  const logger = ctx.logger('foo').extend('temp')
  // 执行其他代码并使用 logger 产生输出
}
```

然后，你也可以将你的配置项具体到每一级命名空间中：

```js title=koishi.js
module.exports = {
  logLevel: {
    foo: {
      // 这里也支持配置 base，当然你也可以不写，表示继承上一级的默认等级
      base: 1,
      temp: 3,
    },
  },
}
```

### 配置调试输出

此外，koishi 还提供了一个 `--debug` 选项，你可以临时配置那些要以等级 3 进行输出的命名空间，中间用逗号隔开。例如，`--debug=onebot,foo:temp` 就表示输出来自 onebot 和 foo:temp 的全部内容。

同 `--log-level` 类似，这个选项也将覆盖配置文件中的相关配置。

## 手动调用 Logger

如果你不希望使用 Koishi 的命令行工具，同时又想使用上述种种特性，你可以考虑直接调用 Logger 的底层方法来进行配置。

::: warning
由于手动调用 Logger 并不是我们所推荐的行为，本节中介绍的属性和方法不会记录在文档中，Koishi 也不会保证这些功能不会在版本更新中发生变化。在开发时，请尽量以 @koishijs/utils 包提供的 dts 文件，而非本页面为准。
:::

### Logger.showTime

- 类型：`string`

对应配置项 [`logTime`](../../api/core/app.md#options-logtime)，只支持字符串格式。默认值为空串。

### Logger.showDiff

- 类型：`boolean`

对应配置项 [`logDiff`](../../api/core/app.md#options-logdiff)。默认值为 `false`。

### Logger.levels

- 类型：`LogLevelConfig`

对应配置项 [`logLevel`](../../api/core/app.md#options-loglevel) 和 [`logFilter`](../../api/core/app.md#options-logfilter)，只支持对象格式。默认值为 `{ base: 2 }`。

## 内置的输出

Koishi 自身会产生下列类型的 logger 输出：

TODO

利用上面的方法，你可以借助 koishi 的输出对你的机器人进行调试。
