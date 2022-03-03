---
sidebarDepth: 2
---

# 配置模式

在很多时候，我们会面临一些实用的需求：

- 验证某个配置项是否合法
- 为可缺省的配置项提供默认值
- 在网页控制台中通过表单让用户进行在线配置

为了解决这些需求，我们开发了 [schemastery](https://www.npmjs.com/package/schemastery) 这个库，并将它集成到了 Koishi 中。这一章将介绍如何使用这个库为你的插件声明配置。

## 基本示例

让我们看一个简单的示例。下面的插件将注册一个指令，输出当前插件的配置项。

::: code-group language
```js no-extra-header
const { Schema } = require('koishi')

module.exports.name = 'example'

module.exports.schema = Schema.object({
  foo: Schema.string().required(),
  bar: Schema.number().default(1),
})

module.exports.apply = (ctx, config) => {
  ctx.command('config').action(() => {
    // 输出当前的配置
    return `foo: ${config.foo}\nbar: ${config.bar}`
  })
}
```
```ts no-extra-header
import { Context, Schema } from 'koishi'

export const name = 'example'

export interface Config {
  foo: string
  bar?: number
}

export const schema = Schema.object({
  foo: Schema.string().required(),
  bar: Schema.number().default(1),
})

export function apply(ctx: Context, config: Config) {
  ctx.command('config').action(() => {
    // 输出当前的配置
    return `foo: ${config.foo}\nbar: ${config.bar}`
  })
}
```
:::
