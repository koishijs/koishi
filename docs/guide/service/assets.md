---
sidebarDepth: 2
---

# 存储资源文件

::: warning
`ctx.assets` 并非内置服务。如要使用请同时安装提供此服务的插件，可参见 [相关生态](#相关生态)。
:::

在一些情况下，我们需要非即时地处理含有资源消息段的消息，例如使用 [teach](../../plugins/teach/) 插件添加教学问答，或是在 [github](../../plugins/other/github.md) 插件中快速回复等等。虽然可以直接将这些资源消息段发送出去，但由于涉及的消息会被长时间存储，将会导致一些潜在的问题：

- 部分平台提供的资源链接只对特定账户可用，因此发送出去的消息无法被其他平台解析
- 部分平台提供的资源链接并不是永久生效的，在一段时间后相应的内容将失效

为了解决这些问题，我们设计了 Assets API。通过这个接口，我们可以将资源文件转存起来，并生成永久链接用于后续处理。

## 公开方法

### assets.transform(content)

- **content:** `string` 要处理的消息文本
- 返回值: `Promise<string>` 处理后的消息文本

将消息文本中的资源全部转存，并将链接替换为永久链接。

### assets.stats() <Badge text="抽象" type="warning"/>

- 返回值: `Promise<Stats>` 服务状态信息

```ts
export interface Stats {
  assetCount?: number
  assetSize?: number
}
```

## 内部方法

要实现 Assets API，你需要创建一个 Assets 的派生类。下面将介绍这个类的内部方法。

### assets.analyze(url, file?)

- **url:** `string` 资源 URL
- **file:** `string` 资源文件名
- 返回值: `Promise<FileInfo>` 文件信息

```ts
export interface FileInfo {
  name: string
  filename: string
  hash: string
  buffer: Buffer
}
```

### assets.upload(url, file) <Badge text="抽象" type="warning"/>

- **url:** `string` 资源 URL
- **file:** `string` 资源文件名
- 返回值: `Promise<string>` 永久链接

转存给定的资源文件，返回其对应的永久链接。

## 相关生态

以下是提供此服务的官方插件：

- [@koishijs/plugin-assets-git](../../plugins/assets/git.md)
- [@koishijs/plugin-assets-local](../../plugins/assets/local.md)
- [@koishijs/plugin-assets-remote](../../plugins/assets/local.md)
- [@koishijs/plugin-assets-s3](../../plugins/assets/s3.md)

以下是使用此服务的插件：

- [koishi-plugin-github](../../community/github/) (可选)
- [koishi-plugin-dialogue](../../community/dialogue/) (可选)
