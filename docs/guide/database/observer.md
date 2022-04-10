---
sidebarDepth: 2
---

# 按需加载与自动更新

上面介绍了一些 Koishi 内置的权限管理行为，而接下来将介绍的是开发者如何读取和更新数据。通常来说，中间件、插件的设计可以让机器人的开发变得更加模块化，但是这也带来了数据流向的问题。如果每个中间件分别从数据库中读取和更新自己所需的字段，那会造成大量重复的请求，导致严重的资源浪费；将所有可能请求的数据都在中间件的一开始就请求完成，并不会解决问题，因为一条信息的解读可能只需要少数几个字段，而大部分都是不需要的；更严重的是，后一种做法将导致资源单次请求，多次更新，从而产生种种数据安全性问题。那么针对这些问题，Koishi 又是如何解决的呢？

## 观察者对象

之前我们已经提到过，你可以在 `session.user` 上获得本次事件相关的用户数据，但实际上 `session.user` 能做的远远不止这些。它的本质其实是一个**观察者**对象。假如我们有下面的代码：

```ts
declare function getLotteryItem(): string

// ---cut---
// 定义一个 items 字段，用于存放物品列表
declare module 'koishi' {
  interface User {
    items: string[]
  }
}

ctx.model.extend('user', {
  items: 'list',
})

ctx.command('lottery')
  .userFields(['items'])
  .action(({ session }) => {
    // 这里假设 item 是一个字符串，表示抽到的物品
    const item = getLotteryItem()
    // 将抽到的物品存放到 user.items 中
    session.user.items.push(item)
    return `恭喜您获得了 ${item}！`
  })
```

上面的代码看起来完全无法工作，因为我们都知道将数据写入数据库是一个异步的操作，但是在上面的中间件中我们没有调用任何异步操作。然而如果你运行这段代码，你会发现用户数据被成功地更新了。这就归功于观察者机制。`session.user` 的本质是一个 **观察者对象**，它检测在其上面做的一切更改并缓存下来。当任务进行完毕后，Koishi 又会自动将变化的部分进行更新，同时将缓冲区清空。

这套机制不仅可以将多次更新合并成一次以提高程序性能，更能解决数据竞争的问题。如果两条信息先后被接收到，如果单纯地使用 getUser / setUser 进行处理，可能会发生后一次 getUser 在前一次 setUser 之前完成，导致本应获得 2 件物品，但实际只获得了 1 件的问题。而观察者会随时同步同源数据，数据安全得以保证。

当然，如果你确实需要阻塞式地等待数据写入，我们也提供了 `user.$update()` 方法。顺便一提，一旦成功执行了观察者的 `$update()` 方法，之前的缓冲区将会被清空，因此之后不会重复更新数据；对于缓冲区为空的观察者，`$update()` 方法也会直接返回，不会产生任何的数据库访问。这些都是我们优化的几个细节。

你可以在 [这里](../../api/utils/observer.md) 看到完整的观察者 API。

## 声明所需字段

如果说观察者机制帮我们解决了多次更新和数据安全的问题的话，那么这一节要介绍的就是如何控制要加载的内容。在上面的例子中我们看到了 `cmd.userFields()` 函数，它通过一个 [可迭代对象](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Iteration_protocols) 或者回调函数来添加所需的用户字段。同理我们也有 `cmd.channelFields()` 方法，功能类似。

如果你需要对全体指令添加所需的用户字段，可以使用 `command/before-attach-user` 事件。下面是一个例子：

```ts
// 注意这不是实例方法，而是类上的静态方法
ctx.before('command/attach-user', (argv, fields) => {
  fields.add('name')
})

ctx.before('command/execute', ({ session, command }) => {
  console.log('%s calls command %s', session.user.name, command.name)
})
```

如果要控制中间件能取得的用户数据，可以监听 before-user 和 before-channel 事件，通过修改传入的 `fields` 参数来添加特定的字段。下面是一个例子：

```ts
// 定义一个 msgCount 字段，用于存放收到的信息数量
declare module 'koishi' {
  interface User {
    msgCount: number
  }
}

ctx.model.extend('user', {
  msgCount: 'integer',
})

// 手动添加要获取的字段，下面会介绍
ctx.before('attach-user', (session, fields) => {
  fields.add('msgCount')
})

ctx.middleware((session: Session<'msgCount'>, next) => {
  // 这里更新了 msgCount 数据
  session.user.msgCount++
  return next()
})
```

## 使用会话 API

对于 Koishi 内部的两个抽象表 User 和 Channel，我们在 [会话对象](../../api/core/session.md) 中封装了几个高级方法：

```ts
declare const id: string
declare const fields: any[]

// ---cut---
// 中间增加了一个第二参数，表示默认情况下的权限等级
// 如果找到该用户，则返回该用户本身
session.getUser(id, fields)

// 在当前会话上绑定一个可观测用户实例
// 也就是所谓的 session.user
session.observeUser(fields)

// 中间增加了一个第二参数，表示默认情况下的 assignee
// 如果找到该频道，则不修改任何数据，返回该频道本身
session.getChannel(id, fields)

// 在当前会话上绑定一个可观测频道实例
// 也就是所谓的 session.channel
session.observeChannel(fields)
```
