---
title: 编写第一段代码
sidebarDepth: 2
---

# 编写第一段 Koishi 代码

Koishi 项目通常可以通过两种方式搭建：

- **手动编写 js 代码并直接调用 Koishi 接口**
- 通过官方脚手架快速搭建 Koishi 控制台项目

本节主要介绍第一种方式，也是最经典，最适合开发者的上手方式。

::: tip
这篇指南假设你已了解关于 JavaScript 和 Node.js 的中级知识。如果你刚开始学习 JS 开发或者对编写业务代码不感兴趣，或许 [控制台项目](./console.md) 会更加适合你。
:::

## 准备工作

Koishi 需要 [NodeJS](https://nodejs.org/) (最低 v12，推荐使用 LTS) 运行环境，你需要自己安装它。同时，我们还强烈建议您安装 [yarn](https://classic.yarnpkg.com/lang/en/) 作为包管理器。在下面的文档中，我们将默认使用 yarn。

Koishi 支持多个聊天平台，对于不同的平台，你也需要做好相应的准备工作。

- [接入 OneBot (QQ)](../../plugins/adapter/onebot.md)
- [接入 Discord](../../plugins/adapter/discord.md)
- [接入 Telegram](../../plugins/adapter/telegram.md)
- [接入开黑啦](../../plugins/adapter/kaiheila.md)

如果你还没有准备好对接到哪些平台，也不用着急，Koishi 可以在不对接任何平台的情况直接启动（只不过没有机器人你就无法进行交互了）。

## 初始化项目

首先初始化你的机器人目录并安装 Koishi 和所需的插件（这里以官方插件 onebot 和 common 为例）：

::: code-group manager
```npm
# 初始化项目
npm init

# 安装 koishi 和相关库
npm i koishi @koishijs/plugin-adapter-onebot @koishijs/plugin-common
```
```yarn
# 初始化项目
yarn init

# 安装 koishi 和相关库
yarn add koishi @koishijs/plugin-adapter-onebot @koishijs/plugin-common
```
:::

新建入口文件 `index.js`，并写下这段代码：

```js index.js
const { App } = require('koishi')

// 创建一个 Koishi 应用
const app = new App()

// 安装 onebot 适配器插件，并配置机器人
app.plugin('adapter-onebot', {
  protocol: 'ws',
  selfId: '123456789',
  endpoint: 'ws://127.0.0.1:6700',
})

// 安装 common 插件，你可以不传任何配置项
app.plugin('common')

// 启动应用
app.start()
```

最后运行这个文件（在此之前别忘了先完成 [准备工作](#准备工作)）：

```cli
node .
```

现在可以对你的机器人说话了：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">echo 你好</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">你好</chat-message>
</panel-view>

## 添加交互逻辑

现在让我们在上面的代码中添加一段自己的交互逻辑：

```js index.js
// 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
app.middleware((session, next) => {
  if (session.content === '天王盖地虎') {
    return session.send('宝塔镇河妖')
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

## 配置数据库

数据库是机器人开发的常见需求，许多插件本身也要求你安装数据库。在 Koishi 这里，数据库支持也可以通过插件来安装！这里以 MySQL 为例。首先安装所需的依赖：

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
