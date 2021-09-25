---
sidebarDepth: 2
---

# 创建 OneBot (QQ) 机器人

## 框架介绍

[OneBot](https://github.com/howmanybots/onebot) 是一个聊天机器人应用接口标准，目前可用于 QQ 聊天机器人的实现。你可以使用下列实现该协议的框架：

- [Mrs4s/go-cqhttp](https://github.com/Mrs4s/go-cqhttp)（推荐）
- [yyuueexxiinngg/cqhttp-mirai](https://github.com/yyuueexxiinngg/cqhttp-mirai)
- [richardchien/coolq-http-api](https://github.com/richardchien/coolq-http-api)（配合 [iTXTech/mirai-native](https://github.com/iTXTech/mirai-native) 使用）

我们推荐使用 **go-cqhttp**。在本文的后续部分我们只会介绍这个框架的使用方法。有对其他框架感兴趣的同学也可以自行探索。

## 通信方式

同时，OneBot 协议还规定了四种不同的通信方式：

- 正向 HTTP：OneBot 作为 HTTP 服务端，提供 API 调用服务
- 反向 HTTP：OneBot 作为 HTTP 客户端，向用户配置的 URL 推送事件，并处理用户返回的响应
- 正向 WebSocket：OneBot 作为 WebSocket 服务端，接受用户连接，提供 API 调用和事件推送服务
- 反向 WebSocket：OneBot 作为 WebSocket 客户端，主动连接用户配置的 URL，提供 API 调用和事件推送服务

我们推荐使用 **正向 WebSocket**，这种通信方式操作简便，且拥有相对较高的性能。在本文的后续部分我们将介绍每一种通信方式的配置方法。

## 安装与运行

1. 首先从 [这个页面](https://github.com/Mrs4s/go-cqhttp/releases) 下载并解压最新版本的 go-cqhttp
2. 打开命令行并 cd 到你的解压目录
3. 输入 `./go-cqhttp` 并运行，此时将提示：

```sh
未找到配置文件，正在为您生成配置文件中！
请选择你需要的通信方式:
  1: HTTP 通信
  2: 正向 WebSocket 通信
  3: 反向 WebSocket 通信
你的选择是: 2           # 根据你的需求可作更改，输入后回车进入下一步
默认配置文件已生成，请修改 config.yml 后重新启动。
```

4. 根据 [配置参考](#配置参考) 中的说明修改 config.yml 文件。之后再次输入 `./go-cqhttp` 并运行：

```
[INFO]: 登录成功 欢迎使用: balabala
```

5. 如出现需要认证的信息, 请自行认证设备。

### 快速启动

默认情况下启用 go-cqhttp 将会有五秒钟的延时，可以使用命令行参数 `faststart` 进行跳过：

```sh
./go-cqhttp faststart
```

## 配置参考

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

```yaml koishi.config.yml
port: 8080
plugins:
  onebot:
    protocol: http
    selfId: '123456789'
    server: http://127.0.0.1:5700
    secret: my-secret
```

### 正向 WebSocket

```yaml config.yml
servers:
  - ws:
      host: 127.0.0.1
      port: 6700
```

```yaml koishi.config.yml
plugins:
  onebot:
    protocol: ws
    selfId: '123456789'
    server: ws://127.0.0.1:6700
```

### 反向 WebSocket

```yaml config.yml
servers:
  - ws-reverse:
      universal: ws://127.0.0.1:8080/onebot
```

```yaml koishi.config.yml
port: 8080
plugins:
  onebot:
    protocol: ws-reverse
    selfId: '123456789'
```

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

```yaml koishi.config.yml
# 请注意这里的 port 可能跟 selfUrl 中的不一致
# 你可以通过 nginx，candy 等工具实现端口的转发和 SSL 等需求
port: 8080
selfUrl: https://my-host:9090
plugins:
  onebot:
    path: /foo
```

## 常见问题

#### 我的 go-cqhttp 初次启动时并没有生成 config.yml。

请插件你的 go-cqhttp 是否为最新版本。

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

## 获取更新

除了直接用前面的方法下载新版本并替换原文件外，go-cqhttp 还提供了另一种获取更新的方式。

在命令行中进入 go-cqhttp 所在目录并输入：

```sh
./go-cqhttp update
```

如果在国内连接 GitHub 下载速度可能很慢, 可以使用镜像源下载：

```sh
./go-cqhttp update https://github.rc1844.workers.dev
```

几个可用的镜像源：

- `https://hub.fastgit.org`
- `https://github.com.cnpmjs.org`
- `https://github.bajins.com`
- `https://github.rc1844.workers.dev`

## 安装 FFmpeg

为了支持任意格式的语音发送, 你需要安装 FFmpeg。

### Windows

[点击这里](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z) 下载并解压, 并为 `bin` 这个文件夹添加环境变量。

如果遇到下载速度缓慢的问题可以用 [这个源](https://downloads.go-cqhttp.org/ffmpeg-release-full.7z)。

### Ubuntu / Debian

在终端执行：

```shell
apt install -y ffmpeg
```

### Fedora / RHEL / CentOS

在终端执行：

```shell
# Centos7 及之前
yum install ffmpeg ffmpeg-devel 

# CentOS8 及之后
dnf install ffmpeg ffmpeg-devel
```
