---
sidebarDepth: 2
---

# 速率限制 (Rate Limit)

::: tip
要使用本插件，你需要安装数据库支持。
:::

请先阅读 [指南 / 速率限制](../../guide/command/more.md#速率限制) 章节。

## 扩展用户字段

- **usage:** `Record<string, number>` 指令调用次数
- **timers:** `Record<string, number>` 指令调用时间

## 指令：user.usage
## 指令：user.timer

- 基本语法：`user.xxx [key] [value]`
- 选项：
  - `-s, --set` 设置访问记录（需要 4 级权限）
  - `-c, --clear` 清除访问记录（需要 4 级权限）
  - `-t, --target [@user]` 目标用户（需要 3 级权限）

如果不提供 `-s` 和 `-c` 选项，则会显示当前的访问记录。如果使用了 `-s`，就会设置名为 `key` 的访问记录为 `value`。如果使用了 `-c` 且提供了 `key`，就会清除名为 `key` 的访问记录；否则会清除所有的访问记录。
