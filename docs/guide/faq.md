---
sidebarDepth: 2
---

# 常见问题

## 最常见的问题

### 能收到消息但是不能发消息是什么原因？

如果你使用的是 koishi-adapter-onebot，请先查看你的 go-cqhttp 控制台，看看是不是因为风控导致的消息无法发送。

如果看到报错信息 `TypeError: Cannot read property 'Symbol(koishi.session.send)' of undefined`, 请检查 `App` 构建函数选项或 `koishi.config.js` 中 `bot` 的 `selfId` 是否配置有误，请注意 selfId 必须为字符串。

### 使用 TypeScript 开发时，部分必需的字段并没有代码提示？

你需要手动引入依赖。例如如果你使用 koishi-adapter-onebot，你可以这样做：

```ts koishi.config.ts
import { AppConfig } from 'koishi'
import {} from 'koishi-adapter-onebot'

export default {
  type: 'onebot',
  selfId: '123456789',
  // 如果没有引入上面的模块，这里的字段就没有代码提示
  server: 'http://localhost:5700',
} as AppConfig
```

## 关于生命周期

### 应该如何保证一段代码在成功连接服务器之后执行？

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

## 关于多平台

### 之前的 group 概念在 v3 中变成了 channel，为什么有些地方仍然保留了 group 的写法？

是的，你可以在一些地方看到 v3 中仍在在使用“Group”这个术语，这些地方包括 `session.subtype` 可能的 group 取值以及 `bot.getGroupMember()` 接口等等。这是因为 v3 并不是单纯的将 group 改成了 channel，而是从“群组”的概念中抽象出了“频道”的概念，这是为了跨平台而考虑的。

对于 QQ 这样的聊天平台，每个群组对应着单一的聊天消息序列，在这种情况下群组的概念与频道相重合。但对于 Discord 这样的聊天平台，每一个群组里存在着复数的频道，这些频道都是独立的，机器人需要区分来自每一个频道的消息；而另一方面，群组中的成员又是共通的，自然不能认定其属于某个特定频道。这样一来，为什么是 `bot.getGroupMember()` 而非 <del>`bot.getChannelMember()`</del> 就解释得通了。

### 为什么其他平台的适配器名字都与平台一致，只有 QQ 对应 OneBot？

这是由多方原因共同导致的。

首先，许多平台都公开了自己的机器人接口，只有腾讯官方对机器人采取封杀的态度。因此只有 QQ 的适配器是基于第三方协议实现的，OneBot 正是这个协议的名字。而第三方协议远远不止一个，所以不应该用 QQ 这个笼统的名称。在未来也可能出现其他面向 QQ 的适配器。

反过来，OneBot 作为一个协议，未来也可能支持更多的聊天平台。届时只需有 koishi-adapter-onebot，Koishi 也相当于支持了这些平台。一旦出现了这样的情况，用 QQ 作为适配器名反而显得以偏概全了，这也是不妥当的。

但尽管这么说，从目前来看，当我们在讨论用 Koishi 实现 QQ 机器人时，都默认采用这个协议。
