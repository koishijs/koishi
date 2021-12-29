---
sidebarDepth: 2
---

# 对比两种方式

在前面的两节中，我们分别展示了如何使用控制台和手写代码搭建 Koishi 项目。相信你已经发现，无论是哪一种方式都离不开插件的支持。没错，模块化是 Koishi 设计的一大核心，开发者将不同的功能封装到不同的插件中，而机器人的使用者则可以按照自己的需求选择合适的插件。

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
