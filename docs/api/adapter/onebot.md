---
title: 平台：OneBot
sidebarDepth: 2
---

# koishi-adapter-onebot

[OneBot](https://github.com/howmanybots/onebot) (旧名 CQHTTP) 是一个聊天机器人应用接口标准，目前可用于 QQ 机器人。要使用 koishi-adapter-onebot，你需要首先下载一个实现该协议的框架：

- [Mrs4s/go-cqhttp](https://github.com/Mrs4s/go-cqhttp)（推荐）
- [yyuueexxiinngg/cqhttp-mirai](https://github.com/yyuueexxiinngg/cqhttp-mirai)
- [richardchien/coolq-http-api](https://github.com/richardchien/coolq-http-api)（配合 [iTXTech/mirai-native](https://github.com/iTXTech/mirai-native) 使用）

上述框架也在 OneBot 的基础上扩展了各自的接口，而这些扩展的功能也被包含在了 koishi-adapter-onebot 中。

- 标有 <Badge vertical="baseline" text="go-cqhttp" type="warn"/> 的 API 只能基于 go-cqhttp 运行

## 机制说明

### 异步调用

OneBot 提出了**异步调用**的概念，当 OneBot 服务器受到异步调用请求时，如果调用正确，将直接返回 200。这样做的好处是，如果某些操作有较长的耗时（例如发送含有大量图片的消息或清空数据目录等）或你不关心调用结果，使用异步调用可以有效防止阻塞。下面说明了异步调用和普通调用的关系：

![async-method](/async-method.png)

但是另一方面，你也无法得知异步调用是否成功被执行。与此同时，没有副作用的异步调用也毫无意义（因为这些调用本身就是为了获取某些信息，但是异步调用是无法获取调用结果的）。因此，Koishi 为除此以外的所有异步调用都提供了 API，它们的调用接口与非异步的版本除了在方法后面加了一个 `Async` 外没有任何区别：

```js
// 普通版本
const messageId = await app.sender.sendPrivateMsg(123456789, 'Hello world')

// 异步版本，无法获得调用结果
await app.sender.sendPrivateMsgAsync(123456789, 'Hello world')
```

::: tip 提示
虽然异步调用方法的名字以 Async 结尾，但是其他方法也是**异步函数**，它们都会返回一个 `Promise` 对象。取这样的名字只是为了与 OneBot 保持一致。
:::

### 快捷回复

Meta 对象还提供了一个快捷回复方法 `session.send`，调用它可以快速实现对原消息的回复。快捷操作的响应速度会高于普通的 Sender API 调用，但是默认情况下这种操作同上面的异步调用一样，这些操作也是无法获得调用结果的。完整的快捷操作列表参见 [Koishi 添加的属性](#koishi-添加的属性)。

这里也简单介绍一下快捷操作的原理。当正常使用 HTTP 模式时，每个事件上报和 API 调用都使用了不同的连接。那么快捷操作则相当于将 API 调用作为事件上报的响应。当然，这种做法有着很多限制，例如对 WebSocket 无效，同一个事件只能响应一次，以及需要手动处理响应超时的问题。因此，默认情况下这种优化是不开启的。如果手动配置了 `quickOperationTimeout`，则会将这个配置项作为时间限制，在这个时间限制内第一个调用快捷操作的会享受这种优化（事实上大部分操作都只有一个响应，所以这种优化对 HTTP 往往是非常有效的），之后的所有快捷操作调用都会自动转化为异步调用，这样可以保证快捷操作永远都是可用的。

下面这张图比较了使用 HTTP 时，快捷操作与默认机制的区别：

![quick-operation](/quick-operation.png)

### HTTP 和 WebSocket 应该如何选择？

目前 Koishi 已经完全实现了 OneBot 提供的 HTTP 和 WebSocket 通信方式，因此它们之间**不存在任何功能上的差别**。

但是，HTTP 需要 Koishi 和 OneBot 所处于同一台机器，或所处的机器都拥有公网 IP；而 WebSocket 只需要 Koishi 和 OneBot 所处于同一台机器，或运行 OneBot 的机器拥有公网 IP。因此如果你在服务端运行 CoolQ，同时在个人电脑上调试你的 Koishi 应用，你应当选择使用 WebSocket 模式。

从性能上说，WebSocket 占用的资源会更少（因为不需要每次都建立连接），但是响应速度可能不如 HTTP；另一方面，当一个 Koishi 应用同时管理着多个机器人时，HTTP 能通过快捷调用和服务器复用的方式来提高性能，但是 WebSocket 并没有这些机制。

## 事件

metaEvent 系列事件对应这 CQHTTP 插件本身的元事件，**只会在 App 实例触发**。所有这些事件的回调函数都会传入一个 [`Meta` 对象](../guide/message.md#深入-meta-对象)。这些事件的共同点是 `meta.postType` 都为 `'meta_event'`。

### 事件：heartbeat

心跳元事件，**仅对 WebSocket 生效**。产生此事件需要通过将配置项 `enable_heartbeat` 设置为 `true`，并可通过 `heartbeat_interval` 配置心跳间隔（单位毫秒）。

### 事件：lifecycle

生命周期事件，**仅对 HTTP 生效**。拥有下面的子事件：

- lifecycle/enable: CQHTTP 插件启用
- lifecycle/disable: CQHTTP 插件停用
- lifecycle/connect: 成功建立 WebSocket 连接

## App 构造函数选项

下面的配置项来自 koishi-adapter-cqhttp。你需要将你的 [`type`](#options-type) 字段配置为 `cqhttp`, `cqhttp:http`, `cqhttp:ws` 或 `cqhttp:ws-reverse` 中的一种。如果缺省或使用了 `cqhttp`，Koishi 会读取你的 `server` 选项，根据你配置的服务器 URL 进行适配。

相关 OneBot 配置：`use_http`, `use_ws`。

### options.path

- 类型：`string`

服务器监听的路径。相关 OneBot 配置：`post_url`。

### options.secret

- 类型：`string`

接收信息时用于验证的字段，应与 OneBot 的 `secret` 配置保持一致。

### options(.bots[]).server

- 类型：`string`

如果使用了 HTTP，则该配置将作为发送信息的服务端；如果使用了 WebSocket，则该配置将作为监听事件和发送信息的服务端。

相关 OneBot 配置：`host`, `port`, `ws_host`, `ws_port`。

### options(.bots[]).token

- 类型：`string`

发送信息时用于验证的字段，应与 OneBot 的 `access_token` 配置保持一致。

### options.retryTimes

- 类型：`number`

WebSocket 允许重新连接的次数。默认值为 `0`。

### options.retryInterval

- 类型：`number`

WebSocket 重新尝试连接前的等待时间，单位为毫秒。默认值为 `5000`。

### options.quickOperation

- 类型：`number`

快捷操作的时间限制，单位为毫秒。如果配置了这个选项且使用了 HTTP 通信方式，则在这段时间内的首次调用 `meta.send()` 或类似的方法将不产生新的 HTTP 请求。默认值为 `100`。参见 [**快捷操作**](../guide/message.md#快捷操作) 一节。

## 发送消息

### bot.$sendGroupMsg(groupId, message, autoEscape?)

- **groupId:** `number` 群号
- **message:** `string` 要发送的内容
- **autoEsacpe:** `boolean` 消息内容是否作为纯文本发送（即不解析 CQ 码）
- 返回值: `Promise<number>` 新信息的 messageId

发送群消息。

### bot.$sendGroupForwardMsg(groupId, nodes) <Badge text="go-cqhttp" type="warn"/>

- **groupId:** `number` 群号
- **nodes:** `CQNode[]` 消息节点列表
- 返回值: `Promise<void>`

发送群批量转发消息。

```js
interface CQNode {
  type: 'node'
  data: {
    id: number
  } | {
    name: string
    uin: number
    content: string
  }
}
```

### bot.$sendLike(userId, times?)

- **userId:** `number` 好友 QQ 号
- **times:** `number` 点赞次数
- 返回值: `Promise<void>`

给好友点赞。

::: warning 注意
本接口仅限**对好友**使用。
:::

### bot.$getGroupMsg(messageId) <Badge text="go-cqhttp" type="warn"/>

- **messageId:** `number` 消息编号
- 返回值: `Promise<GroupMessage>`

发送群批量转发消息。

```js
export interface GroupMessage {
  messageId: number
  realId: number
  sender: AuthorInfo
  time: number
  content: string
}
```

### bot.$getForwardMsg(messageId) <Badge text="go-cqhttp" type="warn"/>

- **messageId:** `number` 消息编号
- 返回值: `Promise<ForwardMessage>`

发送群批量转发消息。

```js
export interface ForwardMessage {
  messages: {
    sender: AuthorInfo
    time: number
    content: string
  }[]
}
```

## 群相关

### bot.$setGroupKick(groupId, userId, rejectAddRequest?)

- **groupId:** `number` 群号
- **userId:** `number` QQ 号
- **rejectAddRequest:** `boolean` 拒绝此人的加群请求
- 返回值: `Promise<void>`

踢出群聊或拒绝加群。

### bot.$setGroupBan(groupId, userId, duration?)

- **groupId:** `number` 群号
- **userId:** `number` QQ 号
- **duration:** `number` 禁言时长（秒），设为 0 表示解除禁言
- 返回值: `Promise<void>`

群组单人禁言。

### bot.$setGroupAnonymousBan(groupId, anonymous, duration?)

- **groupId:** `number` 群号
- **anonymous:** `object | string` 匿名用户的信息或 flag，参见 [Message 型元数据属性](../guide/message.md#message-型元数据属性)
- **duration:** `number` 禁言时长（秒），设为 0 表示解除禁言
- 返回值: `Promise<void>`

群组匿名用户禁言。

### bot.$setGroupWholeBan(groupId, enable?)

- **groupId:** `number` 群号
- **enable:** `boolean` 是否禁言，默认为 `true`
- 返回值: `Promise<void>`

群组全员禁言。

### bot.$setGroupAdmin(groupId, userId, enable?)

- **groupId:** `number` 群号
- **userId:** `number` QQ 号
- **enable:** `boolean` 是否设置为管理员，默认为 `true`
- 返回值: `Promise<void>`

群组设置管理员。

### bot.$setGroupAnonymous(groupId, enable?)

- **groupId:** `number` 群号
- **enable:** `boolean` 是否允许匿名，默认为 `true`
- 返回值: `Promise<void>`

群组设置匿名。

### bot.$setGroupCard(groupId, userId, card?)

- **groupId:** `number` 群号
- **userId:** `number` QQ 号
- **card:** `string` 群名片
- 返回值: `Promise<void>`

设置群名片。

### bot.$setGroupLeave(groupId, isDismiss?)

- **groupId:** `number` 群号
- **isDismiss:** `boolean` 是否解散群（仅对群主生效）
- 返回值: `Promise<void>`

退出群组。

### bot.$setGroupSpecialTitle(groupId, userId, specialTitle?, duration?)

- **groupId:** `number` 群号
- **userId:** `number` QQ 号
- **specialTitle:** `string` 专属头衔
- **duration:** `number` 有效时长（秒，目前可能没用）
- 返回值: `Promise<void>`

设置群组专属头衔。

### bot.$sendGroupNotice(groupId, title, content)

- **groupId:** `number` 群号
- **title:** `string` 标题
- **content:** `string` 内容
- 返回值: `Promise<void>`

发布群公告。

### bot.$setGroupName(groupId, name) <Badge text="go-cqhttp" type="warn"/>

- **groupId:** `number` 群号
- **name:** `string` 群名称
- 返回值: `Promise<void>`

修改群名称。

## 处理请求

### bot.$setFriendAddRequest(flag, approve?, remark?)

- **flag:** `string` 加好友请求的 flag（需从上报的数据中获得）
- **approve:** `boolean` 是否同意请求，默认为 `true`
- **remark:** `string` 好友备注名（仅当同意时有效）
- 返回值: `Promise<void>`

处理加好友请求。

### bot.$setGroupAddRequest(flag, subtype, approve?, reason?)

- **flag:** `string` 加群请求的 flag（需从上报的数据中获得）
- **subtype:** `'add' | 'invite'` 子类型，参见 [Request 型元数据属性](../guide/message.md#request-型元数据属性)
- **approve:** `boolean` 是否同意请求，默认为 `true`
- **reason:** `string` 拒绝理由（仅当拒绝时有效）
- 返回值: `Promise<void>`

处理加群请求或邀请。

## 账号信息

### bot.$getLoginInfo()

- 返回值: `Promise<UserInfo>` 登录号信息

获取登录号信息。

```js
export interface UserInfo {
  userId: number
  nickname: string
}
```

### bot.$getVipInfo()

- 返回值: `Promise<VipInfo>` 会员信息

获取会员信息。

```js
export interface VipInfo extends UserInfo {
  level: number
  levelSpeed: number
  vipLevel: number
  vipGrowthSpeed: number
  vipGrowthTotal: string
}
```

### bot.$getStrangerInfo(userId, noCache?)

- **userId:** `number` 目标 QQ 号
- **noCache:** `boolean` 是否不使用缓存，默认为 `false`
- 返回值: `Promise<StrangerInfo>` 陌生人信息

获取陌生人信息。

```js
export interface StrangerInfo extends UserInfo {
  sex: 'male' | 'female' | 'unknown'
  age: number
}
```

### bot.$getFriendList()

- 返回值: `Promise<FriendInfo[]>` 好友列表

获取好友列表。

```js
export interface FriendInfo extends UserInfo {
  remark: string
}
```

### bot.$getGroupList()

- 返回值: `Promise<ListedGroupInfo[]>` 群信息列表

获取群列表。

```js
export interface ListedGroupInfo {
  groupId: number
  groupName: string
}
```

### bot.$getGroupInfo(groupId, noCache?)

- **groupId:** `number` 目标群号
- **noCache:** `boolean` 是否不使用缓存，默认为 `false`
- 返回值: `Promise<GroupInfo>` 群信息

获取群信息。

```js
export interface GroupInfo extends ListedGroupInfo {
  memberCount: number
  maxMemberCount: number
}
```

### bot.$getGroupMemberInfo(groupId, userId, noCache?)

- **groupId:** `number` 目标群号
- **userId:** `number` 目标 QQ 号
- **noCache:** `boolean` 是否不使用缓存，默认为 `false`
- 返回值: `Promise<GroupMemberInfo>` 群成员信息

获取群成员信息。

```js
export interface SenderInfo extends StrangerInfo {
  area?: string
  card?: string
  level?: string
  role?: 'owner' | 'admin' | 'member'
  title?: string
}

export interface GroupMemberInfo extends SenderInfo {
  cardChangeable: boolean
  groupId: number
  joinTime: number
  lastSentTime: number
  titleExpireTime: number
  unfriendly: boolean
}
```

### bot.$getGroupMemberList(groupId)

- **groupId:** `number` 目标群号
- 返回值: `Promise<GroupMemberInfo[]>` 群成员列表

获取群成员列表。

### bot.$getGroupNotice(groupId)

- **groupId:** `number` 目标群号
- 返回值: `Promise<GroupNoticeInfo[]>` 群公告列表

获取群公告列表。部分字段具体含义可能需要自行理解。

```js
export interface GroupNoticeInfo {
  cn: number
  fid: string
  fn: number
  msg: {
    text: string
    textFace: string
    title: string
  }
  pubt: number
  readNum: number
  settings: {
    isShowEditCard: number
    remindTs: number
  }
  u: number
  vn: number
}
```

## 其他操作

### bot.$getCookies(domain?)

- **domain:** `string` 需要获取 cookies 的域名
- 返回值: `Promise<string>` cookies

获取 Cookies。

### bot.$getCsrfToken()

- 返回值: `Promise<string>` CSRF Token

获取 CSRF Token。

### bot.$getCredentials()

- **domain:** `string` 需要获取 cookies 的域名
- 返回值: `Promise<Credentials>` 接口凭证

获取 QQ 相关接口凭证，相当于上面两个接口的合并。

```js
export interface Credentials {
  cookies: string
  csrfToken: number
}
```

### bot.$getRecord(file, outFormat, fullPath?)

- **file:** `string` 语音文件名
- **outFormat:** `'mp3' | 'amr' | 'wma' | 'm4a' | 'spx' | 'ogg' | 'wav' | 'flac'`
- **fullPath:** `boolean` 是否返回文件的绝对路径
- 返回值: `Promise<RecordInfo>`

获取语音：并不是真的获取语音，而是转换语音到指定的格式，然后返回 `data/record` 目录下的语音文件名。注意，要使用此接口，需要安装 CoolQ 的 [语音组件](https://cqp.cc/t/21132)。

```js
export interface RecordInfo {
  file: string
}
```

### bot.$getImage(file)

- **file:** `string` 图片文件名
- 返回值: `Promise<ImageInfo>`

获取图片：与上面类似，不过返回 `data/image` 目录下的图片路径。

```js
export interface ImageInfo {
  file: string

  // go-cqhttp 特有
  size: number
  filename: string
  url: string
}
```

### bot.$canSendImage()

- 返回值: `Promise<boolean>` 是否可以发送图片

检查是否可以发送图片。

### bot.$canSendRecord()

- 返回值: `Promise<boolean>` 是否可以发送语音

检查是否可以发送语音。

### bot.$getStatus()

- 返回值: `Promise<StatusInfo>` 插件运行状态

获取插件运行状态。

```js
export interface StatusInfo {
  appInitialized: boolean
  appEnabled: boolean
  pluginsGood: boolean
  appGood: boolean
  online: boolean
  good: boolean
}
```

### bot.$getVersionInfo()

- 返回值: `Promise<VersionInfo>` 插件版本信息

获取 OneBot 的版本信息。

```js
export interface VersionInfo {
  coolqDirectory: string
  coolqEdition: 'air' | 'pro'
  pluginVersion: string
  pluginBuildNumber: number
  pluginBuildConfiguration: 'debug' | 'release'

  // go-cqhttp 特有
  goCqhttp: boolean
  runtimeVersion: string
  runtimeOs: string
}
```

### bot.$setRestart(cleanLog?, cleanCache?, cleanEvent?)

- **cleanLog:** `boolean` 是否在重启时清空 CoolQ 的日志数据库（log*.db）
- **cleanCache:** `boolean` 是否在重启时清空 CoolQ 的缓存数据库（cache.db）
- **cleanEvent:** `boolean` 是否在重启时清空 CoolQ 的事件数据库（eventv2.db）
- 返回值: `Promise<void>`

重启 CoolQ，并以当前登录号自动登录（需勾选快速登录）。

::: warning 警告
由于强行退出可能导致 CoolQ 数据库损坏而影响功能，此接口除非必要请尽量避免使用。
:::

### bot.$setRestartPlugin(delay?)

- **delay:** `string` 要延迟的毫秒数，如果默认情况下无法重启，可以尝试设置延迟为 2000 左右
- 返回值: `Promise<void>`

重启 HTTP API 插件。

### bot.$cleanDataDir(dataDir)

- **dataDir:** `'image' | 'record' | 'show' | 'bface'` 要清理的目录名
- 返回值: `Promise<void>`

清理积攒了太多旧文件的数据目录。

### bot.$cleanPluginLog()

- 返回值: `Promise<void>`

清空插件的日志文件。
