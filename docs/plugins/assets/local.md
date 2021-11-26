---
title: 资源存储：Local
sidebarDepth: 2
---

# @koishijs/plugin-assets-local

在一些情况下，我们需要非即时地处理含有资源消息段的消息，例如使用 [teach](../teach/) 添加问答或使用 [github](./github.md) 快速回复等等。

虽然可以直接将这些消息段发送出去，但是部分平台提供的资源链接并不是永久生效的，在一段时间后相应的内容将失效。在这种情况下，我们需要找出某种可行的方式，将资源文件转存起来，并生成永久链接用于后续处理。

## 使用本地目录存储

```js koishi.config.js
module.exports = {
  plugins: {
    assets: {
      type: 'local',
      // 本地存储资源文件的绝对路径
      root: '',
      // 静态图片暴露在服务器的路径，默认为 '/assets'
      path: '',
      // Koishi 暴露在公网的地址，默认为 appOptions.selfUrl
      selfUrl: '',
      // 防止恶意上传的密钥（配合下一节使用）
      secret: '',
    },
  },
}
```
