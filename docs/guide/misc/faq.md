---
sidebarDepth: 2
---

# 常见问题

## 生命周期相关

#### 应该如何保证一段代码在成功连接服务器之后执行？

可以有很多种方式。你可以利用 `app.start()` 返回的 `Promise` 对象：

```js
app.start().then(() => {
  app.bots[0].sendPrivateMsg('123456789', '你的机器人上线了')
})
```

此外，你还可以利用 `connect` 事件：

```js
app.on('connect', () => {
  app.bots[0].sendPrivateMsg('123456789', '你的机器人上线了')
})

// 先注册回调函数，再启动应用
app.start()
```

## 跨平台相关

#### 之前的 group 概念在 v3 中变成了 channel，为什么有些地方仍然保留了 group 的写法？

是的，你可以在一些地方看到 v3 中仍在在使用“Group”这个术语，这些地方包括 `session.subtype` 可能的 group 取值以及 `bot.getGroupMember()` 接口等等。这是因为 v3 并不是单纯的将 group 改成了 channel，而是从“群组”的概念中抽象出了“频道”的概念，这是为了跨平台而考虑的。

对于 QQ 这样的聊天平台，每个群组对应着单一的聊天消息序列，在这种情况下群组的概念与频道相重合。但对于 Discord 这样的聊天平台，每一个群组里存在着复数的频道，这些频道都是独立的，机器人需要区分来自每一个频道的消息；而另一方面，群组中的成员又是共通的，自然不能认定其属于某个特定频道。这样一来，为什么是 `bot.getGroupMember()` 而非 <del>`bot.getChannelMember()`</del> 就解释得通了。

## TypeScript 相关

#### 使用 TypeScript 开发时，部分必需的字段并没有代码提示。

你需要手动引入依赖。例如如果你使用 @koishijs/plugin-onebot，你可以这样做：

```ts koishi.config.ts
import { defineConfig } from '@koishijs/cli'
import {} from '@koishijs/plugin-onebot'

export default defineConfig({
  onebot: {
    selfId: '123456789',
    // 如果没有引入上面的模块，这里的字段就没有代码提示
    endpoint: 'http://localhost:5700',
  },
})
```
