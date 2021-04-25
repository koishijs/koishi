---
sidebarDepth: 2
---

# 从旧版本迁移

这个页面将介绍 Koishi v3 的新特性和对应的迁移方法。

## 包名变更

koishi-database-mysql 变更为 koishi-plugin-mysql。

此外，你可能还需要额外安装 koishi-adapter-onebot 作为 QQ 平台的支持。

## 钩子函数

Koishi v1 的 `ctx.receiver` 使用了 [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) 来分发事件，而 Koishi v3 则自己实现了一个事件系统。这样做将带来几点好处：

- 使用统一的事件分发机制，无需对每个上下文构造 EventEmitter 实例，具有更高的性能
- `emit`, `parallel`, `bail`, `serial` 等方法能够妥善处理不同场景下的事件回调

```js
ctx.emit()      // 同时触发，返回 void
ctx.parallel()  // 同时触发，返回一个全部完成的 Promise

ctx.bail()      // 依次触发，返回第一个 non-nullable 的结果
ctx.serial()    // 依次触发，返回第一个 resolve non-nullable 的结果
```

相关 API 的迁移方法如下：

```js
ctx.receiver.on(event, callback)    =>  ctx.on(event, callback)
ctx.receiver.emit(event, ...args)   =>  ctx.emit(event, ...args)
ctx.app.emitEvent(...args)          =>  ctx.emit(...args)
```

## 选择器

Koishi v3 提供了选择器，它完全覆盖了 v1 的上下文创建功能并有所增强。

```js
ctx.user(123, 456)                    =>  ctx.select('userId', '123', '456')
ctx.groups.exclude(123, 456)          =>  ctx.unselect('groupId', '123', '456')
ctx.groups.intersect(ctx.user(789))   =>  ctx.select('groupId').select('userId', '789')
```

相关文档：[使用选择器](../guide/context.md#使用选择器)

## 会话接口

Koishi v3 新增了会话的概念，它向下兼容大部分 Koishi v1 元信息对象的特性，并增加了大量方法：

```js
ses.app               // App 实例
ses.bot               // Bot 实例

ses.send()            // 发送消息
ses.sendQueued()      // 延时发送消息
ses.cancelQueued()    // 取消延时队列

ses.middleware()      // 注册仅对当前会话生效的中间件
ses.prompt()          // 等待一条消息
ses.suggest()         // 书写错误提示

ses.resolve()         // 解析 argv 对象
ses.collect()         // 获取指令所需字段
ses.execute()         // 执行指令

ses.getUser()         // 获取用户数据
ses.getChannel()      // 获取频道数据
ses.observeUser()     // 绑定可观测用户实例
ses.observeChannel()  // 绑定可观测频道实例
```

相关文档：[使用会话](../guide/message.md#使用会话)

## 数据库变更

Koishi v3 的数据库相比 v1 发生了许多改动，最为显著的一点就是大部分 group 被替换为了 channel：

```js
extendUser(callback)        =>  User.extend(callback)
createUser(callback)        =>  User.create(callback)
extendChannel(callback)     =>  Channel.extend(callback)
createChannel(callback)     =>  Channel.create(callback)

ctx.db.getUser(...args)     =>  ctx.db.getUser(...args)
                            =>  session.getUser(...args)
ctx.db.getGroup(...args)    =>  ctx.db.getChannel(...args)
                            =>  session.getChannel(...args)
```

同时由于 v3 的跨平台特性，你可能还需要留意 `database.getUser()` 这个接口本身的变化。

相关文档：[使用数据库](../guide/database.md)

## 单一应用实例

Koishi v3 使用单一的 App 实例管理多个机器人账号，这将大幅提高程序的启动速度。

现在可以通过 `ctx.bots` 访问当前 App 下的所有机器人，也可以用 `session.app` 和 `session.bot` 访问当前会话所在的 App 和 Bot 实例了。

```js
// ctx.bot 支持以两种方式索引：
// 首先其本身是一个数组，可以直接用下标或者 forEach, map 等方法
// 其次我们也支持通过 platform:selfId 的方式进行索引
ctx.sender.sendGroupMsg()   =>  ctx.bots[0].sendMessage()
ctx.sender.sendGroupMsg()   =>  ctx.bots[`${platform}:${selfId}`].sendMessage()

appMap[selfId]              =>  session.app
appMap[selfId].sender       =>  session.bot
ctx.sender.sendGroupMsg()   =>  session.bot.sendMessage()

app.selfId                  =>  bot.selfId
getSelfIds()                =>  app.bots.map(bot => bot.selfId)
```

同时我们也不再需要全局的生命周期方法了。直接使用 v1 就有的生命周期方法即可控制所有 Bot 实例。

```js
startAll()              =>  app.start()
stopAll()               =>  app.stop()

onStart(cb)             =>  ctx.on('connect', cb)
onStop(cb)              =>  ctx.on('disconnect', cb)
```

其他的构造选项变更：

- commandPrefix -> prefix
- maxMiddlewares -> maxListeners
- defaultAuthority -> autoAuthorize
- similarityCoefficient -> minSimilarity
- quickOperationTimeout -> onebot.quickOperation

## 指令选项

Koishi v1 的指令系统对 TypeScript 的类型标注并不友好。为了更好地适应强类型和按需获取数据的程序风格，Koishi v3 修改了指令选项的行为：

```js
// v1
cmd.option('-f, --foo <arg>', 'description', { default: 123 })
cmd.option('-B, --no-bar', 'description')
cmd.option('--baz <arg>', 'description', { isString: true })

// v3
cmd.option('foo', '-f <arg> description', { fallback: 123 })
cmd.option('bar', '-B description', { value: false })
cmd.option('baz', '<arg:string> description')
```

相关文档：[定义选项](../guide/command.md#定义选项)

## 事件名称

为跨平台考虑，Koishi v3 调整了部分事件名称：

```js
'group-recall'            =>  'message-deleted/group'
'friend-recall'           =>  'message-deleted/private'

'friend-add'              =>  'friend-added'
'group-increase'          =>  'group-added'
                          =>  'group-member-added'
'group-decrease'          =>  'group-deleted'
                          =>  'group-member-deleted'

'group-upload'            =>  'group-file-added'
'group-admin'             =>  'group-member/role'
'group-ban'               =>  'group-member/ban'

'notify/*'                =>  'notice/*'

'request/friend'          =>  'friend-request'
'request/group/invite'    =>  'group-request'
'request/group/add'       =>  'group-member-request'

'heartbeat'               =>  'lifecycle/heartbeat'
'lifecycle/*'             =>  'lifecycle/*'
```

## 消息段变更

CQCode 在 v3 中升级为了 [消息段](./segment.md)。你需要调整这些消息段：

```js
'[CQ:at,qq=123]'          =>  '[CQ:at,id=123]'      // 接收和发送
'[CQ:reply,id=123]'       =>  '[CQ:quote,id=123]'   // 接收和发送
'[CQ:image,file=///]'     =>  '[CQ:image,url=///]'  // 仅限发送（接收逻辑不变）
```
