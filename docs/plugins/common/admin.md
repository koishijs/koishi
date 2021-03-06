---
sidebarDepth: 2
---

# 数据管理

::: tip
本章中介绍的内容需要你安装数据库支持，同时建议提前阅读 [指南 · 用户系统管理](../../guide/manage.md)。
:::

## 基础功能

### 指令：callme

- 基本语法：`callme [name]`

callme 指令用于修改用户的昵称。如果不传入参数，则机器人会返回你当前的昵称。重复的昵称、空昵称和含有消息段的昵称是不被接受的。

### 指令：bind

- 基本语法：`bind`
- 最低权限：0

bind 指令用于跨平台绑定账号。该指令 0 级权限即可调用。

如果此指令在私聊环境下被调用，则 Koishi 会生成一串随机码。你只需在 5 分钟内使用你的其他账号在要绑定的平台内向机器人发送这串随机码，即可完成绑定。

如果此指令在群聊环境下被调用，由于此时生成的随机码是公开的，你需要首先按照上述流程发送一次随机码。接着，收到并核验过随机码的机器人将再向你发送一串新的随机码。你仍需要在 5 分钟内使用你一开始的账号在之前的平台内向机器人发送这串随机码，即可完成绑定。

### 指令：authorize

- 别名：auth
- 基本语法：`authorize -t <user> <authority>`
- 最低权限：4

authorize 指令用于设置用户的权限等级。该指令 4 级权限才能调用，且需要满足目标用户的权限和要设定的权限都严格小于自己的权限等级，否则无法设置。

### 指令：assign

- 基本语法：`assign -t [channel] [assignee]`
- 最低权限：4

assign 指令可用于设置频道的 [代理者](../../guide/manage.md#平台相关字段)。该指令 4 级权限才能调用。

如果 `-t [channel]` 缺省，则表示目标频道为当前频道（因此私聊状态下不能缺省）；如果 `assignee` 缺省，则表示当前接收消息的机器人账号。举个例子，如果要设定一个频道 A 的代理者为 B，下面的两种做法是等价的：

1. 私聊机器人 B，发送 `assign -t #A`
2. 在频道 A 中发送 `@B assign`（假设 B 能收到此消息）

## 高级用法

所有本节中介绍的指令都是指令 user 和 channel 的子指令，且它们都拥有下面的基本选项：

- `-t, --target [@user|#channel]` 目标用户 / 频道（需要 3 级权限）

与上一节介绍的两个指令类似，当这个选项缺省时，默认的目标都是当前用户或当前频道。

### 指令：user.usage
### 指令：user.timer

- 基本语法：`user.xxx [key] [value]`
- 选项：
  - `-s, --set` 设置访问记录（需要 4 级权限）
  - `-c, --clear` 清除访问记录（需要 4 级权限）

这两个指令用于查看和修改用户的访问记录，参见 [指令调用管理](../../guide/manage.md#指令调用管理)。

如果不提供 `-s` 和 `-c` 选项，则会显示当前的访问记录。如果使用了 `-s`，就会设置名为 `key` 的访问记录为 `value`。如果使用了 `-c` 且提供了 `key`，就会清除名为 `key` 的访问记录；否则会清除所有的访问记录。

### 指令：user.flag
### 指令：channel.flag

- 基本语法：`xxx.flag [...names]`
- 选项：
  - `-l, --list` 标记列表
  - `-s, --set` 添加标记（需要 4 级权限）
  - `-S, --unset` 删除标记（需要 4 级权限）

这两个指令用于查看和修改用户或频道的状态标签。如果不提供选项，则会显示当前的状态标签。如果使用了 `-l`，就会列出所有可用的状态标签。如果使用了 `-s` 或 `-S`，则会添加 / 删除 `names` 中的每一个状态标签。
