---
sidebarDepth: 2
---

# 存储资源文件

在一些情况下，我们需要非即时地处理含有资源消息段的消息，例如使用 [teach](../../plugins/teach/) 插件添加教学问答，或是在 [github](../../plugins/other/github.md) 插件中快速回复等等。虽然可以直接将这些资源消息段发送出去，但由于涉及的消息会被长时间存储，将会导致一些潜在的问题：

- 部分平台提供的资源链接只对特定账户可用，因此发送出去的消息无法被其他平台解析
- 部分平台提供的资源链接并不是永久生效的，在一段时间后相应的内容将失效

为了解决这些问题，我们设计了 Assets API。通过这个接口，我们可以将资源文件转存起来，并生成永久链接用于后续处理。

## 使用方法

## 相关生态

这里只收录官方插件和由官方团队维护的插件。如果想了解更多插件的信息，欢迎前往[这里](https://github.com/koishijs/koishi)。

### 实现此服务的插件

- [@koishijs/plugin-assets-local](../../plugins/assets/local.md)
- [@koishijs/plugin-assets-remote](../../plugins/assets/local.md)
- [@koishijs/plugin-assets-jsdelivr](../../plugins/assets/jsdelivr.md)
- [@koishijs/plugin-assets-s3](../../plugins/assets/s3.md)
- [koishi-plugin-assets-smms](https://github.com/koishijs/koishi-plugin-assets-smms)

### 需要此服务的插件

- [@koishijs/plugin-github](../../plugins/other/github.md)（可选）
- [@koishijs/plugin-teach](../../plugins/teach/)（可选）
