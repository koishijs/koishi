---
title: 适配器：OneBot
sidebarDepth: 2
---

# @koishijs/plugin-adapter-onebot

::: warning
尽管 Koishi 使用了 [MIT](https://choosealicense.com/licenses/mit/) 协议，但 OneBot 相关框架普遍使用了基于 [AGPL 3.0](https://choosealicense.com/licenses/agpl-3.0/) 的协议。因此如果你使用 @koishijs/plugin-adapter-onebot 运行你的机器人，你将可能受到 AGPL 3.0 协议的限制，必须将你的代码开源并保持同协议。Koishi 及其作者对使用上述框架或违反上述限制的行为所可能造成的一切后果概不负责。
:::

[OneBot](https://github.com/howmanybots/onebot) 是一个聊天机器人应用接口标准，目前可用于 QQ 聊天机器人的实现。你可以使用下列实现该协议的框架：

- [Mrs4s/go-cqhttp](https://github.com/Mrs4s/go-cqhttp)（推荐）
- [yyuueexxiinngg/cqhttp-mirai](https://github.com/yyuueexxiinngg/cqhttp-mirai)
- [richardchien/coolq-http-api](https://github.com/richardchien/coolq-http-api)（配合 [iTXTech/mirai-native](https://github.com/iTXTech/mirai-native) 使用）

我们推荐使用 go-cqhttp。**在本文的后续部分我们只会介绍 go-cqhttp 的使用方法**。有对其他框架感兴趣的同学也可以自行探索。

与此同时，OneBot 协议规定了四种不同的通信方式：

- 正向 HTTP：OneBot 作为 HTTP 服务端，提供 API 调用服务
- 反向 HTTP：OneBot 作为 HTTP 客户端，向用户配置的 URL 推送事件，并处理用户返回的响应
- 正向 WebSocket：OneBot 作为 WebSocket 服务端，接受用户连接，提供 API 调用和事件推送服务
- 反向 WebSocket：OneBot 作为 WebSocket 客户端，主动连接用户配置的 URL，提供 API 调用和事件推送服务

我们推荐使用正向 WebSocket，这种通信方式操作简便，且拥有相对较高的性能。在本文的后续部分我们将介绍每一种通信方式的配置方法。

## 安装与运行

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

### 快速启动

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

- `https://hub.fastgit.xyz`
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

### options(.bots[]).protocol

- 可选值: http, ws, ws-reverse

如果缺省，Koishi 会读取你的 `endpoint` 选项，根据你配置的服务器 URL 进行适配。

### options(.bots[]).endpoint

- 类型：`string`

如果使用了 HTTP，则该配置将作为发送信息的服务端；如果使用了 WebSocket，则该配置将作为监听事件和发送信息的服务端。

### options(.bots[]).token

- 类型：`string`

发送信息时用于验证的字段。

## 适配器选项

### options.path

- 类型：`string`
- 默认值：`'/onebot'`

服务器监听的路径。仅用于 HTTP 通信方式。

### options.secret

- 类型：`string`

接收信息时用于验证的字段，应与 OneBot 的 `secret` 配置保持一致。

## go-cqhttp 配置参考

首先下面的配置是与通信方式无关的：

```yaml title=config.yml
account:
  uin: 123456     # 必填，QQ 账号
  password: ''    # 推荐，密码为空时将使用扫码登录
```

下面介绍不同的通信方式所需的配置，以及 koishi.yml 的对应配置。

### HTTP

```yaml title=config.yml
servers:
  - http:
      host: 127.0.0.1
      port: 5700
      post:
        - url: http://localhost:8080/onebot
          secret: my-secret
```

::: code-group config koishi
```yaml
port: 8080
plugins:
  adapter-onebot:
    protocol: http
    selfId: '123456789'
    endpoint: http://127.0.0.1:5700
    secret: my-secret
```
```ts
export default {
  port: 8080,
  plugins: {
    'adapter-onebot': {
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

```yaml title=config.yml
servers:
  - ws:
      host: 127.0.0.1
      port: 6700
```

::: code-group config koishi
```yaml
plugins:
  adapter-onebot:
    protocol: ws
    selfId: '123456789'
    endpoint: ws://127.0.0.1:6700
```
```ts
export default {
  plugins: {
    'adapter-onebot': {
      protocol: 'ws',
      selfId: '123456789',
      endpoint: 'ws://127.0.0.1:6700',
    },
  },
}
```
:::

### 反向 WebSocket

```yaml title=config.yml
servers:
  - ws-reverse:
      universal: ws://127.0.0.1:8080/onebot
```

::: code-group config koishi
```yaml
port: 8080
plugins:
  adapter-onebot:
    protocol: ws-reverse
    selfId: '123456789'
```
```ts
export default {
  port: 8080,
  plugins: {
    'adapter-onebot': {
      protocol: 'ws-reverse',
      selfId: '123456789',
    },
  },
}
```
:::

### 配置 `path` 和 `selfUrl`

```yaml title=config.yml
servers:
  # 这里同时列出了 http 和 ws-reverse 中需要做的修改
  # 实际情况下你可能只需要用到其中一份配置
  - http:
      post:
        - url: https://my-host:9090/onebot
  - ws-reverse:
      universal: wss://my-host:9090/onebot
```

::: code-group config koishi
```yaml
# 请注意这里的 port 可能跟 selfUrl 中的不一致
# 你可以通过 nginx，candy 等工具实现端口的转发和 SSL 等需求
port: 8080
selfUrl: https://my-host:9090
plugins:
  adapter-onebot:
    path: /foo
```
```ts
export default {
  // 请注意这里的 port 可能跟 selfUrl 中的不一致
  // 你可以通过 nginx，candy 等工具实现端口的转发和 SSL 等需求
  port: 8080,
  selfUrl: 'https://my-host:9090',
  plugins: {
    'adapter-onebot': {
      path: '/foo',
    },
  },
}
```
:::

## 内部 API

你可以通过 `bot.internal` 或 `session.onebot` 访问到内部 API，参见 [调用机器人](../../guide/message/session.md#调用机器人)。

下面展示了目前已经实现的 API 列表。如要了解细节请自行点击对应方法的链接进行查阅。

### OneBot v11 标准 API

- [`onebot.sendPrivateMsg()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#send_private_msg-发送私聊消息) 发送私聊消息
- [`onebot.sendGroupMsg()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#send_group_msg-发送群消息) 发送群消息
- [`onebot.deleteMsg()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#delete_msg-撤回消息) 撤回消息
- [`onebot.getMsg()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_msg-获取消息) 获取消息
- [`onebot.getForwardMsg()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_forward_msg-获取合并转发消息) 获取合并转发消息
- [`onebot.sendLike()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#send_like-发送好友赞) 发送好友赞
- [`onebot.setGroupKick()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_kick-群组踢人) 群组踢人
- [`onebot.setGroupBan()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_ban-群组单人禁言) 群组单人禁言
- [`onebot.setGroupAnonymousBan()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_anonymous_ban-群组匿名用户禁言) 群组匿名用户禁言 <sup>[1]</sup>
- [`onebot.setGroupWholeBan()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_whole_ban-群组全员禁言) 群组全员禁言
- [`onebot.setGroupAdmin()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_admin-群组设置管理员) 群组设置管理员
- [`onebot.setGroupAnonymous()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_anonymous-群组匿名) 群组匿名 <sup>[2]</sup>
- [`onebot.setGroupCard()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_card-设置群名片群备注) 设置群名片（群备注）
- [`onebot.setGroupName()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_name-设置群名) 设置群名
- [`onebot.setGroupLeave()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_leave-退出群组) 退出群组
- [`onebot.setGroupSpecialTitle()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_special_title-设置群组专属头衔) 设置群组专属头衔
- [`onebot.setFriendAddRequest()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_friend_add_request-处理加好友请求) 处理加好友请求
- [`onebot.setGroupAddRequest()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_add_request-处理加群请求邀请) 处理加群请求／邀请
- [`onebot.getLoginInfo()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_login_info-获取登录号信息) 获取登录号信息
- [`onebot.getStrangerInfo()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_stranger_info-获取陌生人信息) 获取陌生人信息
- [`onebot.getFriendList()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_friend_list-获取好友列表) 获取好友列表
- [`onebot.getGroupInfo()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_info-获取群信息) 获取群信息
- [`onebot.getGroupList()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_list-获取群列表) 获取群列表
- [`onebot.getGroupMemberInfo()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_member_info-获取群成员信息) 获取群成员信息
- [`onebot.getGroupMemberList()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_member_list-获取群成员列表) 获取群成员列表
- [`onebot.getGroupHonorInfo()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_honor_info-获取群荣誉信息) 获取群荣誉信息
- [`onebot.getCookies()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_cookies-获取-cookies) 获取 Cookies <sup>[2]</sup>
- [`onebot.getCsrfToken()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_csrf_token-获取-csrf-token) 获取 CSRF Token <sup>[2]</sup>
- [`onebot.getCredentials()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_credentials-获取-qq-相关接口凭证) 获取 QQ 相关接口凭证 <sup>[2]</sup>
- [`onebot.getRecord()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_record-获取语音) 获取语音 <sup>[2]</sup>
- [`onebot.getImage()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_image-获取图片) 获取图片
- [`onebot.canSendImage()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#can_send_image-检查是否可以发送图片) 检查是否可以发送图片
- [`onebot.canSendRecord()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#can_send_record-检查是否可以发送语音) 检查是否可以发送语音
- [`onebot.getStatus()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_status-获取运行状态) 获取运行状态
- [`onebot.getVersionInfo()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_version_info-获取版本信息) 获取版本信息
- [`onebot.setRestart()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_restart-重启-onebot-实现) 重启 OneBot 实现
- [`onebot.cleanCache()`](https://github.com/botuniverse/onebot-11/blob/master/api/public.md#clean_cache-清理缓存) 清理缓存 <sup>[2]</sup>

注释：

1. 这个方法只有三个参数，其中第二个参数对应 `anonymous` 或 `flag`
2. 这些方法并未被 go-cqhttp 支持，访问时可能出错

### go-cqhttp 扩展 API

- [`onebot.sendGroupForwardMsg()`](https://docs.go-cqhttp.org/api/#发送合并转发-群) 发送合并转发 (群)
- [`onebot.deleteFriend()`](https://docs.go-cqhttp.org/api/#删除好友) 删除好友
- [`onebot.setGroupPortrait()`](https://docs.go-cqhttp.org/api/#设置群头像) 设置群头像
- [`onebot.getWordSlices()`](https://docs.go-cqhttp.org/api/#获取中文分词-隐藏-api) 获取中文分词
- [`onebot.ocrImage()`](https://docs.go-cqhttp.org/api/#图片-ocr) 图片 OCR
- [`onebot.getGroupSystemMsg()`](https://docs.go-cqhttp.org/api/#获取群系统消息) 获取群系统消息
- [`onebot.uploadGroupFile()`](https://docs.go-cqhttp.org/api/#上传群文件) 上传群文件
- [`onebot.getGroupFileSystemInfo()`](https://docs.go-cqhttp.org/api/#获取群文件系统信息) 获取群文件系统信息
- [`onebot.getGroupRootFiles()`](https://docs.go-cqhttp.org/api/#获取群根目录文件列表) 获取群根目录文件列表
- [`onebot.getGroupFilesByFolder()`](https://docs.go-cqhttp.org/api/#获取群子目录文件列表) 获取群子目录文件列表
- [`onebot.getGroupFileUrl()`](https://docs.go-cqhttp.org/api/#获取群文件资源链接) 获取群文件资源链接
- [`onebot.getGroupAtAllRemain()`](https://docs.go-cqhttp.org/api/#获取群-全体成员-剩余次数) 获取群 @全体成员 剩余次数
- [`onebot.getVipInfo()`](https://docs.go-cqhttp.org/api/#获取VIP信息) 获取 VIP 信息
- [`onebot.sendGroupNotice()`](https://docs.go-cqhttp.org/api/#发送群公告) 发送群公告
- [`onebot.downloadFile()`](https://docs.go-cqhttp.org/api/#下载文件到缓存目录) 下载文件到缓存目录
- [`onebot.getOnlineClients()`](https://docs.go-cqhttp.org/api/#获取当前账号在线客户端列表) 获取当前账号在线客户端列表
- [`onebot.getGroupMsgHistory()`](https://docs.go-cqhttp.org/api/#获取群消息历史记录) 获取群消息历史记录
- [`onebot.setEssenceMsg()`](https://docs.go-cqhttp.org/api/#设置精华消息) 设置精华消息
- [`onebot.deleteEssenceMsg()`](https://docs.go-cqhttp.org/api/#移出精华消息) 移出精华消息
- [`onebot.getEssenceMsgList()`](https://docs.go-cqhttp.org/api/#获取精华消息列表) 获取精华消息列表
- [`onebot.checkUrlSafely()`](https://docs.go-cqhttp.org/api/#检查链接安全性) 检查链接安全性 <sup>[3]</sup>
- [`onebot.getModelShow()`](https://docs.go-cqhttp.org/api/#获取在线机型) 获取在线机型
- [`onebot.setModelShow()`](https://docs.go-cqhttp.org/api/#设置在线机型) 设置在线机型

注释：

3. 这个方法名与 go-cqhttp 一致，并不是拼写错误

### QQ 频道 API <Badge type="warning" text="meta"/>

- [`onebot.getGuildServiceProfile()`](https://github.com/Mrs4s/go-cqhttp/blob/master/docs/guild.md#获取频道系统内BOT的资料) 获取频道系统内 BOT 的资料
- [`onebot.getGuildList()`](https://github.com/Mrs4s/go-cqhttp/blob/master/docs/guild.md#获取频道列表) 获取频道列表
- [`onebot.getGuildMetaByGuest()`](https://github.com/Mrs4s/go-cqhttp/blob/master/docs/guild.md#通过访客获取频道元数据) 通过访客获取频道元数据
- [`onebot.getGuildChannelList()`](https://github.com/Mrs4s/go-cqhttp/blob/master/docs/guild.md#获取子频道列表) 获取子频道列表
- [`onebot.getGuildMembers()`](https://github.com/Mrs4s/go-cqhttp/blob/master/docs/guild.md#获取频道成员列表) 获取频道成员列表
- [`onebot.sendGuildChannelMsg()`](https://github.com/Mrs4s/go-cqhttp/blob/master/docs/guild.md#发送信息到子频道) 发送信息到子频道

### 使用异步调用

OneBot 提出了 **异步调用** 的概念，当 OneBot 服务器受到异步调用请求时，如果调用正确，将直接返回 200。这样做的好处是，如果某些操作有较长的耗时（例如发送含有大量图片的消息或清空数据目录等）或你不关心调用结果，使用异步调用可以有效防止阻塞。下面说明了异步调用和普通调用的关系：

![async-method](/async-method.png)

但是另一方面，你也无法得知异步调用是否成功被执行。与此同时，没有副作用的异步调用也毫无意义（因为这些调用本身就是为了获取某些信息，但是异步调用是无法获取调用结果的）。因此，Koishi 为除此以外的所有异步调用都提供了 API，它们的调用接口与非异步的版本除了在方法后面加了一个 Async 外没有任何区别：

```js
// 普通版本
const messageId = await session.onebot.sendPrivateMsg('123456789', 'Hello world')

// 异步版本，无法获得调用结果
await session.onebot.sendPrivateMsgAsync('123456789', 'Hello world')
```

::: tip
虽然异步调用方法的名字以 Async 结尾，但是其他方法也是异步函数，它们都会返回一个 Promise 对象。取这样的名字只是为了与 OneBot 保持一致。
:::

## 常见问题

#### 我不知道应该下载 release 中的哪一个文件。

在终端执行：

```cli
node -e "console.log(process.arch)"
```

然后根据输出结果决定你要下载的文件的后缀部分：

- x32: 386
- x64: amd64
- arm64: arm64
- arm: armv7

#### 我的 go-cqhttp 初次启动时并没有生成 config.yml。

请检查你的 go-cqhttp 是否为最新版本。

#### 使用 HTTP 或反向 WebSocket 时无法接收消息，同时 go-cqhttp 有报错。

请检查你的配置是否正确。尤其注意以下几点：

- koishi.yml 中的 `selfId` 必须写并且必须是字符串
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
