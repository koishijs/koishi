---
title: 适配器：OneBot
sidebarDepth: 2
---

# @koishijs/plugin-adapter-onebot

::: warning
尽管 Koishi 使用了 [MIT](https://choosealicense.com/licenses/mit/) 协议，但 OneBot 相关框架普遍使用了基于 [AGPL 3.0](https://choosealicense.com/licenses/agpl-3.0/) 的协议。因此如果你使用 @koishijs/plugin-adapter-onebot 运行你的机器人，你将可能受到 AGPL 3.0 协议的限制，必须将你的代码开源并保持同协议。Koishi 及其作者对使用上述框架或违反上述限制的行为所可能造成的一切后果概不负责。
:::

- 标有 <Badge vertical="baseline" text="go-cqhttp" type="warning"/> 的 API 只能基于 go-cqhttp 运行

## 框架介绍

[OneBot](https://github.com/howmanybots/onebot) 是一个聊天机器人应用接口标准，目前可用于 QQ 聊天机器人的实现。你可以使用下列实现该协议的框架：

- [Mrs4s/go-cqhttp](https://github.com/Mrs4s/go-cqhttp)（推荐）
- [yyuueexxiinngg/cqhttp-mirai](https://github.com/yyuueexxiinngg/cqhttp-mirai)
- [richardchien/coolq-http-api](https://github.com/richardchien/coolq-http-api)（配合 [iTXTech/mirai-native](https://github.com/iTXTech/mirai-native) 使用）

我们推荐使用 go-cqhttp。在本文的后续部分我们只会介绍这个框架的使用方法。有对其他框架感兴趣的同学也可以自行探索。

### 通信方式

OneBot 协议规定了四种不同的通信方式：

- 正向 HTTP：OneBot 作为 HTTP 服务端，提供 API 调用服务
- 反向 HTTP：OneBot 作为 HTTP 客户端，向用户配置的 URL 推送事件，并处理用户返回的响应
- 正向 WebSocket：OneBot 作为 WebSocket 服务端，接受用户连接，提供 API 调用和事件推送服务
- 反向 WebSocket：OneBot 作为 WebSocket 客户端，主动连接用户配置的 URL，提供 API 调用和事件推送服务

我们推荐使用正向 WebSocket，这种通信方式操作简便，且拥有相对较高的性能。在本文的后续部分我们将介绍每一种通信方式的配置方法。

### 安装与运行

1. 首先从 [这个页面](https://github.com/Mrs4s/go-cqhttp/releases) 下载并解压最新版本的 go-cqhttp
   - 如果你不知道下载哪一个，[请看这里](#我不知道应该下载-release-中的哪一个文件。)
2. 打开命令行并 cd 到你的解压目录
3. 输入 `./go-cqhttp` 并运行，此时将提示：

```cli
未找到配置文件，正在为您生成配置文件中！
请选择你需要的通信方式:
  1: HTTP 通信
  2: 正向 WebSocket 通信
  3: 反向 WebSocket 通信
你的选择是: 2           # 根据你的需求可作更改，输入后回车进入下一步
默认配置文件已生成，请修改 config.yml 后重新启动。
```

4. 根据 [配置参考](#go-cqhttp-配置参考) 中的说明修改 config.yml 文件。之后再次输入 `./go-cqhttp` 并运行：

```cli
[INFO]: 登录成功 欢迎使用: balabala
```

5. 如出现需要认证的信息, 请自行认证设备。

#### 快速启动

默认情况下启用 go-cqhttp 将会有五秒钟的延时，可以使用命令行参数 `faststart` 进行跳过：

```cli
./go-cqhttp faststart
```

### 获取更新

除了直接用前面的方法下载新版本并替换原文件外，go-cqhttp 还提供了另一种获取更新的方式。

在命令行中进入 go-cqhttp 所在目录并输入：

```cli
./go-cqhttp update
```

如果在国内连接 GitHub 下载速度可能很慢, 可以使用镜像源下载：

```cli
./go-cqhttp update https://github.rc1844.workers.dev
```

几个可用的镜像源：

- `https://hub.fastgit.org`
- `https://github.com.cnpmjs.org`
- `https://github.bajins.com`
- `https://github.rc1844.workers.dev`

### 安装 FFmpeg

为了支持任意格式的语音发送, 你需要安装 FFmpeg。

#### Windows

[点击这里](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z) 下载并解压, 并为 `bin` 这个文件夹添加环境变量。

如果遇到下载速度缓慢的问题可以用 [这个源](https://downloads.go-cqhttp.org/ffmpeg-release-full.7z)。

#### Ubuntu / Debian

在终端执行：

```cli
apt install -y ffmpeg
```

#### Fedora / RHEL / CentOS

在终端执行：

```cli
# Centos7 及之前
yum install ffmpeg ffmpeg-devel 

# CentOS8 及之后
dnf install ffmpeg ffmpeg-devel
```

## 机器人选项

### options(.bots[]).type

- 可选值: onebot, onebot:http, onebot:ws, onebot:ws-reverse

如果使用了 onebot，Koishi 会读取你的 `server` 选项，根据你配置的服务器 URL 进行适配。

相关 OneBot 配置：`use_http`, `use_ws`。

### options(.bots[]).server

- 类型：`string`

如果使用了 HTTP，则该配置将作为发送信息的服务端；如果使用了 WebSocket，则该配置将作为监听事件和发送信息的服务端。

相关 OneBot 配置：`host`, `port`, `ws_host`, `ws_port`。

### options(.bots[]).token

- 类型：`string`

发送信息时用于验证的字段，应与 OneBot 的 `access_token` 配置保持一致。

## 适配器选项

包括全部的 [`WsClient`](../adapter.md#类-adapter-wsclient) 选项和下列额外选项：

### options.path

- 类型：`string`
- 默认值：`'/onebot'`

服务器监听的路径。仅用于 HTTP 通信方式。

相关 OneBot 配置：`post_url`。

### options.secret

- 类型：`string`

接收信息时用于验证的字段，应与 OneBot 的 `secret` 配置保持一致。

## go-cqhttp 配置参考

首先下面的配置是与通信方式无关的：

```yaml config.yml
account:
  uin: 123456     # 必填，QQ 账号
  password: ''    # 推荐，密码为空时将使用扫码登录
```

下面介绍不同的通信方式所需的配置，以及 koishi.config.yml 的对应配置。

### HTTP

```yaml config.yml
servers:
  - http:
      host: 127.0.0.1
      port: 5700
      post:
        - url: http://localhost:8080/onebot
          secret: my-secret
```

::: code-group config koishi.config
```yaml
port: 8080
plugins:
  onebot:
    protocol: http
    selfId: '123456789'
    endpoint: http://127.0.0.1:5700
    secret: my-secret
```
```ts
export default {
  port: 8080,
  plugins: {
    onebot: {
      protocol: 'http',
      selfId: '123456789',
      endpoint: 'http://127.0.0.1:5700',
      secret: 'my-secret',
    },
  },
}
```
:::

### 正向 WebSocket

```yaml config.yml
servers:
  - ws:
      host: 127.0.0.1
      port: 6700
```

::: code-group config koishi.config
```yaml
plugins:
  onebot:
    protocol: ws
    selfId: '123456789'
    endpoint: ws://127.0.0.1:6700
```
```ts
export default {
  plugins: {
    onebot: {
      protocol: 'ws',
      selfId: '123456789',
      endpoint: 'ws://127.0.0.1:6700',
    },
  },
}
```
:::

### 反向 WebSocket

```yaml config.yml
servers:
  - ws-reverse:
      universal: ws://127.0.0.1:8080/onebot
```

::: code-group config koishi.config
```yaml
port: 8080
plugins:
  onebot:
    protocol: ws-reverse
    selfId: '123456789'
```
```ts
export default {
  port: 8080,
  plugins: {
    onebot: {
      protocol: 'ws-reverse',
      selfId: '123456789',
    },
  },
}
```
:::

### 配置 `path` 和 `selfUrl`

```yaml config.yml
servers:
  # 这里同时列出了 http 和 ws-reverse 中需要做的修改
  # 实际情况下你可能只需要用到其中一份配置
  - http:
      post:
        - url: https://my-host:9090/onebot
  - ws-reverse:
      universal: wss://my-host:9090/onebot
```

::: code-group config koishi.config
```yaml
# 请注意这里的 port 可能跟 selfUrl 中的不一致
# 你可以通过 nginx，candy 等工具实现端口的转发和 SSL 等需求
port: 8080
selfUrl: https://my-host:9090
plugins:
  onebot:
    path: /foo
```
```ts
export default {
  // 请注意这里的 port 可能跟 selfUrl 中的不一致
  // 你可以通过 nginx，candy 等工具实现端口的转发和 SSL 等需求
  port: 8080,
  selfUrl: 'https://my-host:9090',
  plugins: {
    onebot: {
      path: '/foo',
    },
  },
}
```
:::

## 常见问题

#### 我不知道应该下载 release 中的哪一个文件。

- Windows：右击我的电脑 → 属性 → 处理器，在这里可以看到架构
- MacOS：如果你的电脑能安装 iOS 应用，那就是 arm，不然就是 amd64
- Linux：在命令行中输入 `lscpu`，看 arch 那一行输出

#### 我的 go-cqhttp 初次启动时并没有生成 config.yml。

请检查你的 go-cqhttp 是否为最新版本。

#### 使用 HTTP 或反向 WebSocket 时无法接收消息，同时 go-cqhttp 有报错。

请检查你的配置是否正确。尤其注意以下几点：

- koishi.config.yml 中的 `selfId` 必须写并且必须是字符串
- 如果你使用 HTTP：请不要忘记配置 post，同时默认情况下 post 的 `url` 字段应该包含 `/onebot`
- 如果你使用反向 WebSocket：默认情况下 `universal` 字段应该包含 `/onebot`

#### 发送消息时提示「账号可能被风控」。

以下内容摘自 [Mrs4s/go-cqhttp#211](https://github.com/Mrs4s/go-cqhttp/issues/211#issuecomment-812059109) 和 [Mrs4s/go-cqhttp#633](https://github.com/Mrs4s/go-cqhttp/issues/633)：

风控也是分种类的，有 xml 消息被风控，有 json 消息被风控，也有发消息全部被风控。官方客户端正常那可以尝试更换 device.json 文件。再次声明，风控是随机事件，有人挂三五个月都不会被风控，有人天天被风控。是否风控由腾讯根据网络环境，设备，发送的消息来判断。

这里留下几个建议:

- 不要在短时间内进行批量操作
- 不要在新设备登录不久发长信息 / xml / json 信息，以 100 字内的信息最佳
- 不要过分使用敏感操作

#### 为什么其他平台的适配器名字都与平台一致，只有 QQ 对应 OneBot？

这是由多方原因共同导致的。

首先，许多平台都公开了自己的机器人接口，只有腾讯官方对机器人采取封杀的态度。因此只有 QQ 的适配器是基于第三方协议实现的，OneBot 正是这个协议的名字。而第三方协议远远不止一个，所以不应该用 QQ 这个笼统的名称。在未来也可能出现其他面向 QQ 的适配器。

反过来，OneBot 作为一个协议，未来也可能支持更多的聊天平台。届时只需有 @koishijs/plugin-onebot，Koishi 也相当于支持了这些平台。一旦出现了这样的情况，用 QQ 作为适配器名反而显得以偏概全了，这也是不妥当的。

但尽管这么说，从目前来看，当我们在讨论用 Koishi 实现 QQ 机器人时，都默认采用这个协议。

## 发送消息

### bot.$sendGroupMsg(groupId, message, autoEscape?)

- **groupId:** `number` 群号
- **message:** `string` 要发送的内容
- **autoEsacpe:** `boolean` 消息内容是否作为纯文本发送（即不解析 CQ 码）
- 返回值: `Promise<number>` 新信息的 messageId

发送群消息。

### bot.$sendGroupForwardMsg(groupId, nodes) <Badge text="go-cqhttp" type="warning"/>

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

### bot.$getGroupMsg(messageId) <Badge text="go-cqhttp" type="warning"/>

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

### bot.$getForwardMsg(messageId) <Badge text="go-cqhttp" type="warning"/>

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

### bot.$setGroupName(groupId, name) <Badge text="go-cqhttp" type="warning"/>

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
