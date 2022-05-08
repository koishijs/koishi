---
sidebarDepth: 2
---

# 撤回消息 (Recall)

::: tip
此插件仅限在群聊环境中使用。
:::

## 指令：recall

- 基本语法：`recall [count]`
- 最低权限：2

recall 指令用于撤回机器人在当前频道发送的最后几条消息。count 是要撤回的消息的数量，缺省时为 1。

与 broadcast 类似，为了避免风控，每撤回一条消息后 Koishi 也会等待一段时间，同样可以通过 [`delay.broadcast`](../../api/core/app.md#options-delay) 进行配置。

## 配置项

### config.timeout

- 类型: `number`
- 默认值: `Time.hour`

保存已发送消息的时间。超时的消息将被清除。
