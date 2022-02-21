---
sidebarDepth: 2
---

# 直接调用 Koishi

Koishi 项目通常可以通过两种方式搭建：

- 通过官方脚手架快速搭建 Koishi 控制台项目
- **手动编写 js 代码并直接调用 Koishi 接口**

本节主要介绍第二种方式，也是最经典，最适合开发者的上手方式。

::: tip
这篇指南假设你已了解关于 JavaScript 和 Node.js 的中级知识。如果你刚开始学习 JS 开发或者对编写业务代码不感兴趣，或许 [控制台项目](./template.md) 会更加适合你。
:::

## 准备工作

Koishi 需要 [NodeJS](https://nodejs.org/) (最低 v12，推荐使用 LTS) 运行环境，你需要自己安装它。同时，我们还强烈建议您安装 [yarn](https://classic.yarnpkg.com/lang/en/) 作为包管理器。在下面的文档中，我们将默认使用 yarn。

Koishi 支持多个聊天平台，对于不同的平台，你也需要做好相应的准备工作。

- [Discord](../../plugins/adapter/discord.md)
- [开黑啦](../../plugins/adapter/kaiheila.md)
- [OneBot](../../plugins/adapter/onebot.md)
- [QQ 频道](../../plugins/adapter/qqguild.md)
- [Telegram](../../plugins/adapter/telegram.md)

如果你还没有准备好对接到哪些平台，也不用着急，Koishi 可以在不对接任何平台的情况直接启动 (只不过没有机器人你就无法进行交互了)。

## 初始化项目

首先初始化你的机器人目录并安装 Koishi 和所需的插件 (这里以官方插件 onebot 和 echo 为例)：

::: code-group manager
```npm
# 初始化项目
npm init

# 安装 koishi 和相关库
npm i koishi @koishijs/plugin-adapter-onebot @koishijs/plugin-echo
```
```yarn
# 初始化项目
yarn init

# 安装 koishi 和相关库
yarn add koishi @koishijs/plugin-adapter-onebot @koishijs/plugin-echo
```
:::

新建入口文件 `index.js`，并写下这段代码：

::: code-group language index
```js
const { App } = require('koishi')

// 创建一个 Koishi 应用
const app = new App()

// 安装 onebot 适配器插件，并配置机器人
app.plugin('adapter-onebot', {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

// 安装 echo 插件
app.plugin('echo')

// 启动应用
app.start()
```
```ts
import { App } from 'koishi'

// 创建一个 Koishi 应用
const app = new App()

// 安装 onebot 适配器插件，并配置机器人
app.plugin('adapter-onebot', {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

// 安装 echo 插件
app.plugin('echo')

// 启动应用
app.start()
```
:::

最后运行这个文件 (在此之前别忘了先完成 [准备工作](#准备工作))：

```cli
node .
```

现在可以对你的机器人说话了：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">echo 你好</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">你好</chat-message>
</panel-view>

## 添加更多插件

Koishi 插件可以在 [npm](https://www.npmjs.com/) 上获取。要下载的包名与实际书写的插件短名并不完全一样，遵循以下的规则：

| npm 包名 | 插件名 |
|:-----:|:-----:|
| koishi-plugin-**foo** | foo |
| @koishijs/plugin-**foo** | foo |
| **@bar**/koishi-plugin-**foo** | @bar/foo |

简单来说就是，从 npm 包名中删去 `koishi-plugin-` 和 `@koishijs/plugin-` 两种前缀，剩下的部分就是你要书写的插件名。这样既保证了用户书写简便，又防止了发布的插件污染命名空间。

`app.plugin()` 也支持传入完整的插件对象，这种写法尽管长了一些，但是对于 TypeScript 用户会有更好的类型支持：

```ts
import onebot from '@koishijs/plugin-adapter-onebot'
import * as echo from '@koishijs/plugin-echo'

app.plugin(onebot, {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

app.plugin(echo)
```

请注意到上面的两个插件的导入方式的微妙差异。onebot 插件使用了默认导出，而 echo 插件使用了导出的命名空间。这两种写法存在本质的区别，不能混用。虽然这可能产生一些困扰，但对 TypeScript 用户来说，只需注意到写代码时的类型提示就足以确定自己应该采用的写法。

同理，对于 commonjs 的使用者，如果要使用 `require` 来获取插件对象，也应注意到这种区别：

```js
// 这里的 .default 是不可省略的
app.plugin(require('@koishijs/plugin-adapter-onebot').default, {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

// 这里则不能写上 .default
app.plugin(require('@koishijs/plugin-echo'))
```

为了避免混淆，我们建议 commonjs 的使用者直接使用插件的短名安装插件。

## 添加交互逻辑

现在让我们在上面的代码中添加一段自己的交互逻辑：

```js index.js
// 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
app.middleware((session, next) => {
  if (session.content === '天王盖地虎') {
    return '宝塔镇河妖'
  } else {
    return next()
  }
})
```

然后重新运行你的项目：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">天王盖地虎</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">宝塔镇河妖</chat-message>
</panel-view>

不过这样写可能并不好，因为一旦功能变多，你的 `index.js` 就会变得臃肿。我们推荐将上面的逻辑写在一个单独的文件里，并将它作为一个插件来加载：

::: code-group language ping
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

export function apply(ctx: Context) {
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

::: code-group language
```js
// 这里的 ./ping 是相对于 index.js 的路径
app.plugin(require('./ping'))
```
```ts
// 这里的 ./ping 是相对于 index.js 的路径
import * as ping from './ping'

app.plugin(ping)
```
:::

::: warning
注意：直接写相对于根目录的路径来加载插件的做法只对配置文件生效。在实际编写的代码中加载本地插件时，由于我们无法确定相对路径是基于哪个文件，你还是需要写全 `require`。
:::

## 配置数据库

数据库是机器人开发的常见需求，许多插件本身也要求你安装数据库。在 Koishi 这里，数据库支持也可以通过插件来安装。这里以 MySQL 为例。首先安装所需的依赖：

::: code-group manager
```npm
npm i @koishijs/plugin-database-mysql
```
```yarn
yarn add @koishijs/plugin-database-mysql
```
:::

然后继续修改你的代码，在应用中配置 MySQL 数据库插件：

```js index.js
app.plugin('database-mysql', {
  host: '[your-host]',
  port: 3306,
  user: 'root',
  password: '[your-password]',
  database: '[your-database]',
})
```

这样就大功告成了。得益于 Koishi 的内置 ORM，如果一个插件需要数据库支持，那么它只需要编写通用代码。无论你使用的是 MySQL 还是 MongoDB，Koishi 都能使其正常运行。

## 配置多机器人

如果你要同时运行来自多个平台的机器人，你只需要同时安装着多个平台的适配器插件即可：

```js index.js
// 来自 onebot 适配器的机器人
app.plugin('adapter-onebot', {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

// 来自 discord 适配器的机器人
// 别忘了在使用之前，先安装相应的插件和完成准备工作
app.plugin('adapter-discord', {
  token: 'QwErTyUiOpAsDfGhJkLzXcVbNm',
})
```

如果你要同时运行来自同一个平台的多个机器人，只需将上述配置写进一个 `bots` 数组即可：

```js index.js
app.plugin('adapter-onebot', {
  bots: [{
    // 这里配置你的第一个机器人
    protocol: 'ws',
    selfId: '123456789',
    endpoint: 'ws://127.0.0.1:6700',
  }, {
    // 这里配置你的第二个机器人，你也可以使用不同的通信方式
    protocol: 'http',
    selfId: '234567890',
    endpoint: 'http://127.0.0.1:5700',
  }],
})
```
