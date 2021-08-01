---
title: 总览
sidebarDepth: 2
---

# 常用功能 (common)

::: tip 提示
本章介绍的功能都由 koishi-plugin-common 插件提供。
:::

koishi-plugin-common 包含了一些基本插件，它们在你使用 `koishi` 的命令行工具时是默认安装的。

## 部分安装

如果你觉得某些功能不需要的话，你也可以选择在配置项中排除部分功能：

```js koishi.config.js
module.exports = {
  plugins: {
    common: {
      // 不安装 broadcast 指令
      broadcast: false,
    },
  },
}
```

或者通过使用导入子功能的方式只安装部分功能：

```js index.js
import { broadcast } from 'koishi-plugin-common'

// 只安装 broadcast 指令
app.plugin(broadcast)
```

## 功能列表

以下列出了这个插件包含的功能列表：

| 功能名称 | 需要数据库 | 支持部分排除 |
| :-: | :-: | :-: |
| [admin](./admin.md) | 是 | 是 |
| [bind](./admin.md#指令-bind) | 是 | 是 |
| [broadcast](./basic.md#指令-broadcast) | 是 | 是 |
| [callme](./admin.md#指令-callme) | 是 | 是 |
| [contextify](./basic.md#指令-contextify) | 是 | 是 |
| [echo](./basic.md#指令-echo) | 否 | 是 |
| [feedback](./basic.md#指令-feedback) | 否 | 通过 `operator` 配置 |
| [recall](./basic.md#指令-recall) | 否 | 是 |
| [relay](./handler.md#跨频道消息转发) | 否 | 是 |
| [repeater](./repeater.md) | 否 | 是 |
| [respondent](./handler.md#配置内置问答) | 否 | 是 |
| [verifier](./handler.md#处理好友和群申请) | 否 | 是 |
