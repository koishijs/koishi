---
sidebarDepth: 2
---

# 从 v3 迁移

## 包名变更

**重要：请开发者直接依赖 koishi 而非 @koishijs/core 进行开发。**

- koishi-core 与 node 解耦后更名为 @koishijs/core
- koishi-utils 与 node 解耦后更名为 @koishijs/utils
- koishi 为上述库加上 node 相关代码的整合
- koishi-test-utils 更名为 @koishi/test-utils
- 所有官方插件都改为 @koishijs/plugin-xxx
- 所有官方适配器也调整为插件，名称与上一条一致

## Adapter API

适配器现在通过插件的形式导入了：

```ts koishi.config.js
// before
export default {
  bots: [ /* 机器人配置项 */ ],
  onebot: { /* 适配器配置项 */ },
}

// after
export default {
  bots: [ /* 机器人配置项 */ ],
  plugins: {
    onebot: { /* 适配器配置项 */ },
  },
}
```

## Platform Variant

- 新增了 variant 概念，同时有
  - ``pid = `${platform}#${variant}` ``
  - ``cid = `${pid}:${channelId}` ``
  - ``uid = `${pid}:${userId}` ``
  - ``sid = `${pid}:${selfId}` ``
- Bot API
  - `bot.type`, `bot.platform` 语义不变
  - 新增了 `bot.variant` 和 `bot.pid`
- Database API
  - `user[pid] = pid`
  - `channel.type = pid`
- Session API
  - `session.platform` 语义不变
  - 原有的 `session.type`, `session.subType` 等更名为 `session.event`, `session.subEvent` 等
  - 新增了 `session.type = vid`

## Database API

- 接口变更
  - 新增方法 `db.set(table, query, updates)`
  - 移除方法 `db.getAssignedChannels()`（目前仍然可用）
  - `db.update()` 更名为 `db.upsert()`，语法不变
- 数据结构变更
  - channel 表使用 `type`+`id` 复合主键进行索引，因此 `channel.id` 语义将发生变化

## Cache API

- 新增了 Cache API
- 移除了内置于 koishi-core 中的数据缓存逻辑（但暂无替代品）

## 其他变动

### koishi-core

- `ctx.all()` 被更名为 `ctx.any()`，这是为了搭配新增的 `ctx.never()`
- 移除了 `processMessage` 配置项，即取消了内置的将中文字符替换为简体字的机制

### koishi-utils

- 移除了 `Random.uuid()` 方法，新增了 `Random.id()` 方法
- 移除了 `simplify()` 和 `traditionalize()` 方法，请使用 [simplify-chinese](https://www.npmjs.com/package/simplify-chinese) 这个包
- Observer API 改动：所有 `_` 前缀替换为 `$` 前缀，例如 `observer.$update()`

