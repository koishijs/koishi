---
sidebarDepth: 2
---

# 事件 (Events)

建议配套阅读：[事件与生命周期](../guide/lifecycle.md)

## 上报事件

所有的上报事件都是通过 emit 方式在对应的上下文中触发的（即上下文选择器对这些事件有效，且回调函数的返回值不会影响后续行为）。

### 通用会话属性

以下属性对所有会话都有：

- **type:** `string` 事件名称
- **subtype:** `string` 一级子事件名称
- **subsubtype:** `string` 二级子事件名称
- **platform:** `string` 产生事件的平台
- **selfId:** `string` 收到事件的机器人的平台 ID
- **userId:** `string` 触发事件的用户的平台 ID
- **groupId:** `string` 触发事件的群组的平台 ID
- **channelId:** `string` 触发事件的频道的平台 ID
- **timestamp:** `number` 收到事件的 UNIX 时间，单位为毫秒

### 消息类事件

跟消息有关的几种事件统称为消息类事件，共有以下几种：

- message: 收到新消息
- message-deleted: 消息被删除
- message-updated: 消息被修改
- send: 机器人发出消息

这些事件都还拥有以下的子事件：

- private: 该消息是私聊消息
- group: 该消息是群组消息

与此类事件相关的属性有：

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

- group-added: 加入了群组
- group-deleted: 退出了群组
- group-request: 收到了群组邀请
- group-member-added: 群组成员增加
- group-member-deleted: 群组成员减少
- group-member-request: 收到了入群申请
- friend-added: 好友数量增加
- friend-deleted: 好友数量减少
- friend-request: 收到了好友请求

形如 group(-member)?-(added|deleted) 的事件拥有以下的子事件：

- active: 该操作是由加入或退出方发起的
- passive: 该操作是群组方发起的

形如 group(-member)?-(added|deleted) 的事件拥有以下的属性：

- **operatorId:** `string` 操作者 ID

以 request 结尾的事件拥有下面的属性：

- **messageId:** `string` 请求 ID，可用于 [Bot](./bot.md#处理请求) 方法
- **content:** `string` 请求文本

### 操作类事件

上报事件中最主要的一部分都有着统一的结构：**事件主体** + **操作类型**。例如好友请求事件是 friend-request，群组文件更新事件是 group-file-updated 等。目前支持的事件主体包括以下几种：

- friend
- channel
- group
- group-member
- group-role
- group-file
- group-emoji

操作类型包含以下几种：

- added
- removed
- deleted

### 群成员类事件

### 通知类事件

由系统在频道中发送的各种通知构成了通知类事件，共有以下几种：

- notice/poke: 戳一戳
- notice/lucky-king: 运气王
- notice/honor: 群荣誉

与此类事件相关的属性有：

- **targetId:** `string` 戳一戳的目标用户 ID，运气王的获得者 ID
- **honorType:** `string` 荣誉类型，可能为 talkative, performer, emotion

## 内部事件

若非特别说明，这里的所有事件在全体上下文触发的（即上下文选择器对这些事件无效）。

### 事件：before-connect

- **触发方式:** parallel

开始连接到服务器时触发。

### 事件：connect

- **触发方式:** emit

成功连接到服务器时触发。如果一个插件在注册时，应用已经处于连接状态，则会立即触发。

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

如果没有配置数据库，则两个事件都不会触发；如果不是群聊消息，则 before-attach-channel 事件不会触发。

### 事件：attach-channel
### 事件：attach-user

- **session:** `Session` 当前会话
- **触发方式:** serial

当 Koishi 完成频道 / 用户数据获取后触发。调用时会传入一个 Session 对象，将会拥有 `channel`/`user` 属性。你可以在回调函数中修改这两个属性，这些修改会在后续过程中自动更新到数据库。如果你在回调函数中返回一个 truthy 值，则该会话不会触发指令以及之后的中间件。

如果没有配置数据库，则两个事件都不会触发；如果不是群聊消息，则 attach-channel 事件不会触发。

### 事件：before-send

- **session:** `Session` 消息会话
- **触发方式:** bail

即将发送信息时会在对应的上下文触发。调用时会传入一个事件类型为 [send](#消息类事件) 的会话实例。由于该消息还未发送，这个会话并没有 `messageId` 属性。你可以通过修改 `session.content` 改变发送的内容，或者返回一个 truthy 值以取消该消息的发送。

### 事件：before-command

- **argv:** `Argv` 运行时参数
- **触发方式:** serial

调用指令前会在对应的上下文触发。此时指令的可用性还未经检测，因此可能出现参数错误、权限不足、超过使用次数等情况。你可以通过在回调函数中返回一个字符串以取消该指令的执行。进一步，如果该字符串非空，则会作为此指令执行的结果。

### 事件：command

- **argv:** `Argv` 运行时参数
- **触发方式:** parallel

指令调用完毕后会在对应的上下文触发。

### 事件：middleware

- **session:** `Session` 当前会话
- **触发方式:** emit

在执行完全部中间件后会在对应的上下文触发。

### 事件：before-disconnect

- **触发方式:** parallel

关闭服务器前，或所属插件被卸载时触发。参见 [可卸载的插件](../guide/context.md#可卸载的插件)。

### 事件：disconnect

- **触发方式:** emit

成功关闭服务器后触发。
