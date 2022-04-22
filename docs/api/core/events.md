---
sidebarDepth: 2
---

# 事件 (Events)

Koishi 封装了一套事件系统。其基本用法与 Node.js 自带的 [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) 类似，但支持更多的功能，比如多达 6 种的触发形式以及会话事件等。在了解下面的内容之前，建议你先阅读下面的章节：

- [会话事件](../../guide/message/session.md#会话事件)
- [事件系统](../../guide/plugin/lifecycle.md#事件系统)

## 通用会话事件

这里的会话事件都是通过 emit 方式在对应的上下文中触发的 (即上下文选择器对这些事件有效，且回调函数的返回值不会影响后续行为)。

### 消息类事件

跟消息有关的几种事件统称为消息类事件，共有以下几种：

- message: 收到新消息
- message-deleted: 消息被删除
- message-updated: 消息被修改
- send: 机器人发出消息

与此类事件相关的会话属性有：

- **messageId:** `string` 消息 ID
- **content:** `string` 消息内容
- **author:** 发送者信息
  - **author.userId:** `string` 发送者的平台 ID
  - **author.avatar:** `string` 发送者的头像链接
  - **author.username:** `string` 发送者的平台昵称
  - **author.nickname:** `string` 发送者在当前群组中的昵称
- **quote:** 引用的消息，同样包含 `messageId`, `content` 等属性

### 成员类事件

跟群组、好友有关的事件统称为成员类事件，共有以下几种：

- guild-added: 加入了群组
- guild-deleted: 退出了群组
- guild-request: 收到了群组邀请
- guild-member-added: 群组成员增加
- guild-member-deleted: 群组成员减少
- guild-member-request: 收到了入群申请
- friend-added: 好友数量增加
- friend-deleted: 好友数量减少
- friend-request: 收到了好友请求

形如 guild(-member)?-(added|deleted) 的事件拥有以下的属性：

- **operatorId:** `string` 操作者 ID

以 request 结尾的事件拥有下面的属性：

- **messageId:** `string` 请求 ID，可用于 [Bot](./bot.md#处理请求) 方法
- **content:** `string` 请求文本

### 操作类事件

上报事件中最主要的一部分都有着统一的结构：**事件主体** + **操作类型**。例如好友请求事件是 friend-request，群组文件更新事件是 guild-file-updated 等。目前支持的事件主体包括以下几种：

- friend
- channel
- guild
- guild-member
- guild-role
- guild-file
- guild-emoji

操作类型包含以下几种：

- added
- removed
- deleted

<!-- ### 群成员类事件

### 通知类事件

由系统在频道中发送的各种通知构成了通知类事件，共有以下几种：

- notice/poke: 戳一戳
- notice/lucky-king: 运气王
- notice/honor: 群荣誉

与此类事件相关的属性有：

- **targetId:** `string` 戳一戳的目标用户 ID，运气王的获得者 ID
- **honorType:** `string` 荣誉类型，可能为 talkative, performer, emotion -->

## 内置会话事件

与上面介绍的通用会话事件不同，这里的事件都是 Koishi 自身实现的，它们有不同的触发方式，但是都会支持上下文选择器。

### 事件：middleware

- **session:** `Session` 当前会话
- **触发方式:** emit

在执行完全部中间件后会在对应的上下文触发。

### 事件：before-parse

- **content:** `string` 要解析的文本
- **session:** `Session` 当前会话
- **触发方式:** bail

尝试将文本解析成 Argv 对象时调用。你可以在回调函数中返回一个 Argv 对象以覆盖默认的解析行为。

### 事件：parse

- **argv:** `Argv` 运行时参数
- **触发方式:** bail

尝试将一个未识别出指令的 Argv 对象识别成指令调用时使用。你可以在回调函数中修改传入的 Argv 对象，或者返回一个字符串表示识别出的指令。

### 事件：before-attach-channel
### 事件：before-attach-user

- **session:** `Session` 当前会话
- **fields:** `Set<string>` 要获取的字段列表
- **触发方式:** emit

当 Koishi 试图从数据库获取频道 / 用户信息前触发。你可以在回调函数中通过 `fields.add()` 修改传入的字段集合，增加的字段将可以被指令以及之后的中间件获取到。

这两个事件的触发于内置中间件中。如果没有配置数据库，则两个事件都不会触发；如果不是群聊消息，则 before-attach-channel 事件不会触发。

### 事件：attach-channel
### 事件：attach-user

- **session:** `Session` 当前会话
- **触发方式:** serial

当 Koishi 完成频道 / 用户数据获取后触发。调用时会传入一个 Session 对象，将会拥有 `channel`/`user` 属性。你可以在回调函数中修改这两个属性，这些修改会在后续过程中自动更新到数据库。如果你在回调函数中返回一个 truthy 值，则该会话不会触发指令以及之后的中间件。

如果没有配置数据库，则两个事件都不会触发；如果不是群聊消息，则 attach-channel 事件不会触发。

### 事件：command/before-attach-channel
### 事件：command/before-attach-user

- **session:** `Argv` 运行时参数
- **fields:** `Set<string>` 要获取的字段列表
- **触发方式:** emit

当 Koishi 试图从数据库获取频道 / 用户信息前触发。你可以在回调函数中通过 `fields.add()` 修改传入的字段集合，增加的字段将可以被指令以及之后的中间件获取到。

这两个事件触发于任意指令调用前。如果没有配置数据库，则两个事件都不会触发；如果不是群聊消息，则 before-attach-channel 事件不会触发。

### 事件：before-send

- **session:** `Session` 消息会话
- **触发方式:** bail

即将发送信息时会在对应的上下文触发。调用时会传入一个事件类型为 [send](#消息类事件) 的会话实例。由于该消息还未发送，这个会话并没有 `messageId` 属性。你可以通过修改 `session.content` 改变发送的内容，或者返回一个 truthy 值以取消该消息的发送。

### 事件：command/before-execute

- **argv:** `Argv` 运行时参数
- **触发方式:** serial

调用指令前会在对应的上下文触发。此时指令的可用性还未经检测，因此可能出现参数错误、权限不足、超过使用次数等情况。你可以通过在回调函数中返回一个字符串以取消该指令的执行。进一步，如果该字符串非空，则会作为此指令执行的结果。

### 事件：command

- **argv:** `Argv` 运行时参数
- **触发方式:** parallel

指令调用完毕后会在对应的上下文触发。

## 生命周期事件

这里的所有事件在全体上下文触发的 (即上下文选择器对这些事件无效)。

### 事件：ready

- **触发方式:** parallel

应用启动时触发。如果一个插件在加载时，应用已经处于启动状态，则会立即触发。

### 事件：dispose

- **触发方式:** parallel

应用被关闭或插件被卸载时触发。

### 事件：service

- **name:** `string` 服务名称
- **触发方式:** emit

有服务被修改时触发。

### 事件：model

- **name:** `string` 被扩展的表名
- **触发方式:** emit

调用 `model.extend()` 时触发。

### 事件：bot-added

- **bot:** [`Bot`](./bot.md) 机器人实例
- **触发方式:** emit

添加机器人时触发。

### 事件：bot-removed

- **bot:** [`Bot`](./bot.md) 机器人实例
- **触发方式:** emit

移除机器人时触发。

### 事件：bot-status-updated

- **bot:** [`Bot`](./bot.md) 机器人实例
- **触发方式:** emit

[bot.status](./bot.md#bot-status) 发生改变时触发。
