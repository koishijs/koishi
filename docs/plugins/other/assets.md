---
sidebarDepth: 2
---

# 资源转存 (Assets)

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

## 使用远程服务器存储

如果你同时在多台机器上运行了 Koishi（比如一个用于开发，另一个用于生产），同时你又希望把两边的资源文件存放在一起，这个插件同样可以做到！你只需要首先生产环境配置本地存储，同时在开发环境编写下面的配置，即可实现所有的资源文件都统一存放在生产环境的本地目录。

```js koishi.config.js
module.exports = {
  plugins: {
    assets: {
      type: 'remote',
      // 服务器地址
      server: '',
      // 服务器设置的密钥
      secret: '',
    },
  },
}
```

## 使用 SM.MS 存储

[sm.ms](https://sm.ms/) 是一个免费图床服务，可以用来存储 Koishi 接收到的静态资源文件。

```js koishi.config.js
module.exports = {
  plugins: {
    assets: {
      type: 'smms',
      // sm.ms 的访问令牌
      token: '',
    },
  },
}
```
