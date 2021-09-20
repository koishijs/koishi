---
sidebarDepth: 2
---

# 从 v3 迁移

## 包名变更

**重要：请开发者直接依赖 koishi 而非 @koishijs/core 进行开发。**

- koishi-core 与 node 解耦后更名为 @koishijs/core
- koishi-utils 与 node 解耦后更名为 @koishijs/utils
- koishi 为上述库加上 node 相关代码的整合
- 原来的 koishi 现在更名为 @koishijs/cli
- 新增了 create-koishi，可使用 yarn create 或 npm init 一键启动
- **所有官方插件都改为 @koishijs/plugin-xxx**
- **所有官方适配器也调整为插件**，名称与上一条一致
- koishi-test-utils 更名为 @koishijs/test-utils
- koishi-plugin-webui 更名为 @koishijs/plugin-status（~~我又改了回去~~

## 新增包

- create-koishi：可结合 npm init 或 yarn create 使用，用于快速搭建项目
- @koishijs/plugin-ink：使用机器人展示视觉小说（计划中）
- @koishijs/plugin-jsdelivr：使用 jsdelivr 和 GitHub 存放资源文件（计划中）
- @koishijs/plugin-minecraft：在 Minecraft 中使用机器人
- @koishijs/plugin-s3：使用 s3 云存储存放资源文件（计划中）

## 概念用词变更

所有涉及「群组」的概念，对应英文单词从 group 更改为 guild。下面是一些例子：

```diff
- session.groupId
+ session.guildId
- bot.getGroupMember()
+ bot.getGuildMember()
- ctx.on('group-request')
+ ctx.on('guild-request')
```

这样修改是为了提供更好的兼容性，减轻 group 本身在多种场合使用所带来的二义性。

## 插件变更

- 移除了 before-connect 和 before-disconnect 事件，请直接使用 connect 和 disconnect 事件代替
- 移除了 sideEffect 声明，现在所有插件都视为无副作用
- 新增了 [Schema API](./schema.md)，用于描述插件的配置项，下面是一个例子：

```ts
export const name = 'foo'

export const schema: Schema<Config> = Schema.object({
  bar: Schema.string('这是一个配置项').default('baz'),
})

export function apply(ctx: Context, config: Config) {
  config.bar // string
}
```

我们强烈建议开发者在 Koishi v4 插件的开发中为自己的每一个公开插件提供 schema 字段，基于下面的两点好处：

1. 能够在插件被加载前就对插件的配置项进行类型检查，并提供缺省值和更多预处理
2. 如果你希望自己的插件能够**在插件市场被动态安装**，那 schema 会作为网页控制台中呈现的配置表单

## Adapter 变更

适配器现在通过插件的形式导入了：

```ts koishi.config.ts
// before
export default {
  bots: [ /* 机器人配置项 */ ],
  onebot: { /* 适配器配置项 */ },
}

// after
export default {
  plugins: {
    onebot: {
      bots: [ /* 机器人配置项 */ ],
      /* 适配器配置项 */
    },
  },
}
```

同时我们也调整了一些机器人配置项，并支持了一些全新的特性。下面举一些例子：

```ts koishi.config.ts
export default {
  plugins: {
    onebot: {
      // 如果只有一个 bot，你仍然可以像 v3 一样直接写在这里，不用专门提供 bots 数组
      protocol: 'http',   // 相当于过去的 type: 'onebot:http'
      disabled: true,     // 不启动，可以配合网页控制台动态控制运行状态
      platform: 'qq',     // 此时账户信息将从 user.qq 而非 user.onebot 访问
                          // 你还可以对同一个适配器下的多个 bot 实例设置多个不同的平台
    },
  },
}
```

## Bot 变更

## Database 变更

- 接口变更
  - 新增了方法 `db.set(table, query, updates)`
  - 废弃了方法 `db.getAssignedChannels()`（目前暂无替代品，原接口仍然可用）
  - `db.update()` 更名为 `db.upsert()`，语法不变
- 数据结构变更
  - channel 表使用 `platform`+`id` 复合主键进行索引，这意味着 `channel.id` 语义将发生变化，同时新增了 `channel.platform`
- 全局接口变更
  - `Tables.extend()` 接口略有调整，具体参见文档

## 缓存机制变更

- 新增了 Cache API
- 移除了内置于 koishi-core 中的数据缓存逻辑（目前暂无替代品）

## 其他变动

### @koishijs/core

- `ctx.all()` 被更名为 `ctx.any()`，同时新增了 `ctx.never()`
- 移除了 `processMessage` 配置项，即取消了内置的将中文字符替换为简体字的机制

### @koishijs/utils

- 移除了 `Random.uuid()` 方法，新增了 `Random.id()` 方法
- 移除了 `simplify()` 和 `traditionalize()` 方法，请使用 [simplify-chinese](https://www.npmjs.com/package/simplify-chinese) 这个包
- Observer API 改动：所有 `_` 前缀替换为 `$` 前缀，例如 `session.user.$update()`

### @koishijs/plugin-onebot

- `server` 配置项更名为 `endpoint`
- 由于快速响应已经不属于 OneBot 标准，我们移除了对快速响应的支持
