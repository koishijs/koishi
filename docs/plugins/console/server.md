---
sidebarDepth: 2
---

# 服务端 API

## 添加前端入口文件

你可以使用 `webui.addEntry()` 方法添加入口文件。下面是一个例子：

```js my-plugin.js
const { resolve } = require(path)

module.exports = (ctx) => {
  ctx.with('koishi-plugin-webui', () => {
    ctx.console.addEntry(resolve(__dirname, 'client-entry.js'))
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
    ctx.console.addEntry(ctx.console.config.devMode
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
