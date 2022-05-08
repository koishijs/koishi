---
sidebarDepth: 2
---

# 控制台 (Console)

## 配置项

<!-- ### title

- 类型: `string`
- 默认值: `'Koishi 控制台'`

网页控制台的标题。 -->

### uiPath

- 类型: `string`
- 默认值: `/console`

前端页面呈现的路径。

### apiPath

- 类型: `string`
- 默认值: `/status`

后端 API 服务的路径。

### selfUrl

- 类型: `string`
- 默认值: `''`

Koishi 服务暴露在公网的地址。

::: tip
与其他需要 `selfUrl` 配置项的地方不同的是，这里的属性不会继承 `app.options.selfUrl` 的值。这是因为，由于这里缺省时会使用相对路径，网页依旧可以正常访问。

只有你将 `uiPath` 和 `apiPath` 分别部署到了不同的端口或域名时，这个选项才建议使用。
:::

### open

- 类型: `boolean`
- 默认值: `false`

应用启动后自动打开网页。

### devMode

- 类型: `boolean`
- 默认值: `false`

启用[调试模式](#调试模式)。
