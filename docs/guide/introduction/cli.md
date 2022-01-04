---
sidebarDepth: 2
---

# 命令行工具

@koishijs/cli 提供了名为 `koishi` 的命令行工具。如果你之前已经搭建了 [控制台应用](./console.md)，这套命令行工具就已经被集成在其中了。但如果你刚刚完成 [代码上手](./coding.md)，那么你需要手动安装这个包：

::: code-group manager
```npm
npm i @koishijs/cli -D
```
```yarn
yarn add @koishijs/cli -D
```
:::

## 快速启动

`koishi start` 指令需要一个配置文件作为入口。这个配置文件允许 js，ts，json，yaml 等多种格式。默认情况下，配置文件名应当形如 `koishi.config.[ext]`，但你其实也可以传入一个 `file` 参数来指定其他名称。它的完整语法为：

```cli
# 如果你不写这里的 file 参数，程序就会自动寻找 koishi.config.[ext] 文件
koishi start [file] [options]
```

此外，这个指令还支持一些额外的配置项：

- **--log-level:** 控制输出等级
- **--log-time:** 在日志中显示时间
- **--debug:** 最高等级输出的命名空间
- **--watch:** 监听文件变化并重载插件

与输出日志相关的选项请参见 [输出与日志](../service/logger.md) 一章。

## 配置文件

如果你打开控制台项目所在的目录，会发现一个 `koishi.config.yml` 文件，它大概长这样：

```yaml
plugins:
  ./src/ping:
  adapter-onebot:
    protocol: 'ws'
    selfId: '123456789'
    endpoint: 'ws://127.0.0.1:6700'
  common:
```

让我们对比一下代码示例中的 `index.js` 文件，不难发现它们之间的相似：

```js
app.plugin('adapter-onebot', {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

app.plugin('common')
```

没错，配置文件中的 `plugins` 是一个对象，其中的每一个键表示一个插件的名称，而值则表示该插件的配置。而代码示例中的 `app.plugin()` 则接受最多两个参数，分别也是插件的短名和配置。

## 自动重启 <badge text="beta" type="warning"/>

Koishi 的命令行工具支持自动重启。当运行 Koishi 的进程崩溃时，如果 Koishi 已经启动成功，则监视进程将自动重新启动一个新的进程。

同时，你也可以通过指令手动进行重启：

<panel-view :messages="[
  ['Alice', 'exit -r'],
  ['Koishi', '正在重启……'],
  ['Koishi', '重启完成。'],
]"/>

## 模块热替换 <badge text="beta" type="warning"/>

如果你开发着一个巨大的 Koishi 项目，可能光是加载一遍全部插件就需要好几秒了。在这种时候，像前端框架一样支持模块热替换就成了一个很棒的主意。Koishi 也做到了！在启动脚本后加上 `--watch`，就可以实现插件级别的热替换了。每当你修改你的本地文件时，Koishi 就会尝试重载你的插件，并在控制台提醒你。

这里的行为也可以在配置文件中进行定制：

```js koishi.config.js
module.export = {
  watch: {
    // 要监听的根目录，相对于工作路径
    root: 'src',
    // 要忽略的文件列表，支持 glob patterns
    ignore: ['some-file'],
  },
}
```

## 使用 TypeScript

Koishi 支持直接调用 TypeScript 编写的插件。首先安装 typescript 和 ts-node：

::: code-group manager
```npm
npm i typescript ts-node -D
```
```yarn
yarn add typescript ts-node -D
```
:::

接着在你的命令行之后加上一段额外的参数：

::: code-group manager
```npm
npx koishi start -- -r ts-node/register
```
```yarn
# 因为 yarn 自己会吞掉 -- 所以需要额外写一个
yarn koishi start -- -- -r ts-node/register
```
:::

这样你就可以直接使用 koishi.config.ts，或在 koishi.config.js 中引用 ts 文件作为插件了。

::: tip
上述做法并不仅限于 TypeScript。如果你是 CoffeeScript 或者其他语言的使用者，同样可以通过配置 `-r` 参数来实现加载对应语言的配置文件。
:::
