---
sidebarDepth: 2
---

# 网页控制台 (WebUI)

## 指令：status

- 快捷调用：你的状态，查看状态，运行情况，运行状态

status 指令可以用于查看机器人的运行状态。

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">你的状态</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>5 名四季酱正在为 20 个群和 2409 名用户提供服务。</p>
<p>四季酱 2 号：工作中（2/min）</p>
<p>四季酱 3 号：工作中（3/min）</p>
<p>四季酱 4 号：工作中（3/min）</p>
<p>四季酱 5 号：工作中（0/min）</p>
<p>四季酱 9 号：工作中（5/min）</p>
<p>==========</p>
<p>更新时间：2019-12-8 14:41:15</p>
<p>启动时间：2019-12-8 14:52:12</p>
<p>已运行 43 天 10 小时 22 分钟</p>
<p>已载入指令：105</p>
<p>已载入中间件：8</p>
<p>CPU 使用率：1% / 2%</p>
<p>内存使用率：34% / 91%</p>
</chat-message>
</panel-view>

## Web API

本插件还提供了一个 Web API，访问 `http://localhost:{port}/status`，即可获得 JSON 格式的运行状态：

```js
interface BotStatus {
  type: string
  selfId: number
  username: string
  platform: string
  code: number
}

interface Status {
  activeUsers: number
  activeGroups: number
  allUsers: number
  allGroups: number
  storageSize: number
  bots: BotStatus[]
  memory: [number, number]
  cpu: [number, number]
}
```

## 扩展功能

### 修改指令输出

可以使用模板语法修改 status 指令的输出。默认的代码实现如下：

<div v-pre>

```js
template.set('status', {
  bot: '{{ username }}：{{ code ? `无法连接` : `工作中（${currentRate[0]}/min）` }}',
  output: [
    '{{ bots }}',
    '==========',
    '活跃用户数量：{{ activeUsers }}',
    '活跃群数量：{{ activeGroups }}',
    'CPU 使用率：{{ (cpu[0] * 100).toFixed() }}% / {{ (cpu[1] * 100).toFixed() }}%',
    '内存使用率：{{ (memory[0] * 100).toFixed() }}% / {{ (memory[1] * 100).toFixed() }}%',
  ].join('\n'),
})
```
</div>

### 添加前端入口文件

你可以使用 `webui.addEntry()` 方法添加入口文件。下面是一个例子：

```js my-plugin.js
const { resolve } = require(path)

module.exports = (ctx) => {
  ctx.with('koishi-plugin-webui', () => {
    ctx.webui.addEntry(resolve(__dirname, 'client-entry.js'))
  })
}
```

```js client-entry.js
console.log(window) // 你现在可以操作客户端了！
```

## 调试模式 <Badge text="beta" type="warning"/>

调试模式将允许你使用 SFC, HMR 等特性，便于开发自己的功能。

```js src/index.js
const { resolve } = require(path)

module.exports = (ctx) => {
  // 这个方法可以确保其中的内容仅当 webui 插件被载入时调用
  // 即使使用者没有安装 koishi-plugin-webui，你的插件也不会因此而报错
  ctx.with('koishi-plugin-webui', () => {
    // 生产环境和开发环境使用不同的入口文件
    ctx.webui.addEntry(ctx.webui.config.devMode
      ? resolve(__dirname, '../client/index.ts')
      : resolve(__dirname, '../dist/index.js'))
  })
}
```

```js client/index.ts
// 支持 typescript 和 esmodule，同时这里也有类型标注
import { router } from 'koishi-plugin-webui/client'
import MyPage from './my-page.vue'

router.addRoute({
  path: '/my-page',
  name: '扩展页面',
  component: MyPage,
})
```

## 配置项

### title

- 类型: `string`
- 默认值: `'Koishi 控制台'`

网页控制台的标题。

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

### devMode

- 类型: `boolean`
- 默认值: `false`

启用[调试模式](#调试模式)。

### expiration

- 类型: `number`
- 默认值: `Time.week`

登陆控制台所获得的令牌的生效时间。

### tickInterval

- 类型: `number`
- 默认值: `Time.second * 5`

页面同步 profile 数据的时间。
