---
sidebarDepth: 2
---

# 配置项

请注意标有 <Badge text="addons" vertical="baseline"/> 的配置项需要配合 addons 使用。但你可以将相应的参数传给任何一个插件，效果是等价的。

## prefix

- 类型: `string`
- 默认值: `'>'`

快捷调用的前缀字符。设置为 `null` 可以取消 evaluate 指令的快捷调用。

## scriptLoader

- 类型: `string`
- 默认值: `'default'`

evaluate 指令和插值所使用的 Loader。内置的可选值包括 default, typescript 和 esbuild。你也可以自己编写一个 Loader，并在这里配置项中填入文件路径。

## timeout

- 类型: `number`
- 默认值: `1000`

单轮 evaluate 指令执行过程允许的最大等待时长，单位为毫秒。

## userFields

- 类型: `Access<User.Fields>`
- 默认值: `['id', 'authority']`

能够在 evaluate 指令中被访问的用户字段列表。这里的字段也是受 [陷阱](#使用陷阱) 影响的。

## channelFields

- 类型: `Access<Channel.Fields>`
- 默认值: `['id']`

能够在 evaluate 指令中被访问的频道字段列表。这里的字段也是受 [陷阱](#使用陷阱) 影响的。

## resourceLimits

- 类型: [`ResourceLimits`](https://nodejs.org/api/worker_threads.html#worker_threads_worker_resourcelimits)

对子线程的资源限制。

## setupFiles

- 类型: `Record<string, string>`

要在子线程执行的文件名的键值对。键表示你希望在报错信息中显示的模块名，值表示文件的实际路径。如果你要扩展 eval 插件在子线程的行为，你可能需要这个选项。

## serializer

- 类型: `'v8' | 'yaml'`
- 默认值: `'v8'`

要使用的序列化方法。此配置将会影响 [storage](./sandbox.md#storage) 能够支持的类型。

## inspect

- 类型: [`InspectOptions`](https://nodejs.org/api/util.html#util_util_formatwithoptions_inspectoptions_format_args)

用于将传入 [`send`](#send) 方法的参数转化成字符串的配置项。

## root <Badge text="addons"/>

- 类型: `string`

扩展模块的根目录路径。仅当配置了此选项时才会加载 addons 相关特性。

## gitRemote <Badge text="addons"/>

- 类型: `string`

扩展模块更新时的 remote 链接。

## moduleLoaders <Badge text="addons"/>

- 类型: `Record<string, string>`
- 默认值: `{}`

扩展模块所使用的 Loader。键名为文件后缀名，值为对应的 Loader 名称，用法与 [`scriptLoader`](#scriptloader) 类似。
