---
title: 总览
sidebarDepth: 2
---

# 常用功能 (common)

::: tip 提示
本章介绍的功能都由 koishi-plugin-common 插件提供。
:::

::: danger 注意
这里是**正在施工**的 koishi v3 的文档。
:::

koishi-plugin-common 包含了一些基本插件，它们在你使用 `koishi` 库时是默认安装的。

## 指令列表

以下是这个插件包含的指令列表。注明“需要数据库”的指令在没有配置数据库时默认不注册。

| 指令 | 默认权限 | 需要数据库 |
|:-:|:-:|:-:|
| admin | 4 | 是 |
| broadcast | 3 | 是 |
| contextify (ctxf) | 3 | 是 |
| echo | 3 | 否 |
| exec | 4 | 否 |
| exit | 4 | 否 |
| help | 0 | 否 |

你也可以在安装插件时显式地声明某些指令不注册：

```js koishi.config.js
module.exports = {
  plugins: [['common', {
    exit: false,        // 不注册 exit 指令
  }]],
}
```

## 配置列表

除了上述指令都可以声明不注册外，koishi-plugin-common 还提供了其他的一些配置项如下：

| 配置项 | 对应章节 |
|:-:|:-:|
| broadcastInterval | [向所有群广播消息](./message.md#向所有群广播消息) |
| respondent | [配置内置问答](./reply.md#配置内置问答) |
| repeater | [配置复读机](./handler.md#配置复读机) |
| handleFriend | [处理好友申请](./handler.md#处理好友申请、加群邀请和申请) |
| handleGroupAdd | [处理加群申请](./handler.md#处理好友申请、加群邀请和申请) |
| handleGroupInvite | [处理加群邀请](./handler.md#处理好友申请、加群邀请和申请) |
| welcomeMessage | [欢迎新成员](./handler.md#欢迎新成员) |
| getUserName | [查看用户信息](./information.md#查看用户信息) |

## 导出的方法

此外，koishi-plugin-common 还导出了一些方法如下：

| 导出方法 | 对应章节 |
|:-:|:-:|
| registerUserInfo | [扩展要显示的信息](./information.md#扩展要显示的信息) |
| registerUserAction | [添加可用操作](./information.md#添加可用操作) |
| registerGroupAction | [添加可用操作](./information.md#添加可用操作) |
