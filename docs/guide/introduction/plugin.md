---
sidebarDepth: 2
---

# 认识插件

在前面的两节中，我们分别展示了如何使用控制台和手写代码搭建 Koishi 项目。相信你已经发现，无论是哪一种方式都离不开插件的支持。没错，模块化是 Koishi 设计的一大核心，开发者将不同的功能封装到不同的插件中，而机器人的使用者则可以按照自己的需求选择合适的插件。

如果你打开控制台项目所在的目录，会发现一个 `koishi.config.yml` 文件，它大概长这样：

```yaml
plugins:
  ./src/ping:
  adapter-onebot:
    protocol: 'ws'
    selfId: '123456789'
    endpoint: 'ws://127.0.0.1:6700'
  common:
```

让我们对比一下代码示例中的 `index.js` 文件，不难发现它们之间的相似：

```js
app.plugin('adapter-onebot', {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

app.plugin('common')
```

没错，配置文件中的 `plugins` 是一个对象，其中的每一个键表示一个插件的名称，而值则表示该插件的配置。而代码示例中的 `app.plugin()` 则接受最多两个参数，分别也是插件的短名和配置。

## 从 npm 上获取插件

添加插件最简单的途径就是从 [npm](https://www.npmjs.com/) 上获取。要下载的包名与实际书写的插件短名并不完全一样，遵循以下的规则：

| npm 包名 | 插件名 |
|:-----:|:-----:|
| koishi-plugin-**foo** | foo |
| @koishijs/plugin-**foo** | foo |
| **@bar**/koishi-plugin-**foo** | @bar/foo |

简单来说就是，从 npm 包名中删去 `koishi-plugin-` 和 `@koishijs/plugin-` 两种前缀，剩下的部分就是你要书写的插件名。这样既保证了用户书写简便，又防止了发布的插件污染命名空间。

## 传入插件对象

`app.plugin()` 也支持传入完整的插件对象，这种写法尽管长了一些，但是对于 TypeScript 用户会有更好的类型支持：

```ts
import onebot from '@koishijs/plugin-adapter-onebot'
import * as common from '@koishijs/plugin-common'

app.plugin(onebot, {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

app.plugin(common)
```

请注意到上面的两个插件的导入方式的微妙差异。onebot 插件使用了默认导出，而 common 插件使用了导出的命名空间。这两种写法存在本质的区别，不能混用。虽然这可能产生一些困扰，但对 TypeScript 用户来说，只需注意到写代码时的类型提示就足以确定自己应该采用的写法。

同理，对于 cjs 的使用者，如果要使用 `require` 来获取插件对象，也应注意到这种区别：

```js
// 注意这里的 .default 是不可省略的
app.plugin(require('@koishijs/plugin-adapter-onebot').default, {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

// 这里则不能写上 .default
app.plugin(require('@koishijs/plugin-common'))
```

为了避免混淆，我们建议 cjs 的使用者直接使用插件的短名安装插件。

## 编写本地插件

现在让我们再次查看控制台项目所在的目录，会发现一个 `src/ping.js` (或 `src/ping.ts`) 文件：

::: code-group language
```js
module.exports.name = 'ping'

module.exports.apply = (ctx) => {
  // 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
  ctx.middleware(async (session, next) => {
    if (session.content === '天王盖地虎') {
      return '宝塔镇河妖'
    } else {
      return next()
    }
  })
}
```
```ts
import { Context } from 'koishi'

export default function ping(ctx: Context) {
  // 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
  ctx.middleware(async (session, next) => {
    if (session.content === '天王盖地虎') {
      return '宝塔镇河妖'
    } else {
      return next()
    }
  })
}
```
:::

发现了吗？这里的函数体正是 [添加交互逻辑](./coding.md#添加交互逻辑) 中出现的代码。换言之，我们可以创建一个本地插件，在其中编写自己的交互逻辑，然后将相对路径添加到配置文件中。

反过来，对于直接调用 Koishi 的用户，我们也可以将上述代码放入另一个本地文件中，然后修改自己的 `index.js`，引入这个本地插件：

::: code-group language
```js
// 这里的 ./ping 是相对于 index.js 的路径
app.plugin(require('./ping'))
```
```ts
// 这里的 ./ping 是相对于 index.js 的路径
import ping from './ping'

app.plugin(ping)
```
:::

::: warning
注意：直接写相对于根目录的路径来加载插件的做法只对配置文件生效。在实际编写的代码中加载本地插件时，由于我们无法确定相对路径是基于哪个文件，你还是需要写全 `require`。
:::
