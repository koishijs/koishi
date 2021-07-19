---
sidebarDepth: 2
---

# 从 v3 迁移

## 包名变更

**重要：请开发者直接依赖 koishi 而非 @koishijs/core 进行开发。**

- koishi-core 与 node 解耦后更名为 @koishijs/core
- koishi-utils 与 node 解耦后更名为 @koishijs/utils
- koishi 为上述库加上 node 相关代码的整合
- 原有的 koishi 更名为 @koishijs/cli
- 所有官方插件都改为 @koishijs/plugin-xxx
- 所有官方适配器也调整为插件，名称与上一条一致

## 其他变动

### koishi-core

- 移除了 `processMessage` 配置项，即取消了内置的将中文字符替换为简体字的机制

### koishi-utils

- 移除了 `Random.uuid()` 方法，新增了 `Random.id()` 方法
- 移除了 `simplify()` 和 `traditionalize()` 方法，请使用 [simplify-chinese](https://www.npmjs.com/package/simplify-chinese) 这个包

