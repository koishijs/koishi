---
title: 创建控制台项目
sidebarDepth: 2
---

# 创建 Koishi 控制台项目

Koishi 项目通常可以通过两种方式搭建：

- 手动编写 js 代码并直接调用 Koishi 接口
- **通过官方脚手架快速搭建 Koishi 控制台项目**

本节主要介绍第二种方式，也是我们目前推荐的快速上手方案。

## 准备工作

Koishi 需要 [NodeJS](https://nodejs.org/) (最低 v12，推荐使用 LTS) 运行环境，你需要自己安装它。同时，我们还强烈建议您安装 [yarn](https://classic.yarnpkg.com/lang/en/) 作为包管理器。在下面的文档中，我们将默认使用 yarn。

Koishi 支持多个聊天平台，对于不同的平台，你也需要做好相应的准备工作。

- [接入 OneBot (QQ)](./platform/onebot.md)
- [接入 Discord](./platform/discord.md)
- [接入 Telegram](./platform/telegram.md)
- [接入开黑啦](./platform/kaiheila.md)

如果你还没有准备好对接到哪些平台，也不用着急，Koishi 可以在不对接任何平台的情况直接启动。

## 快速启动

打开命令行，输入下面的指令，即可在当前目录下新建并启用一个带控制台的 Koishi 项目：

::: code-group manager
```npm
# 零基础快速搭建 Koishi
npm init koishi
```
```yarn
# 零基础快速搭建 Koishi
yarn create koishi
```
:::

项目启动成功后，会自动为你打开一个浏览器界面，你可以使用界面中的控制台进行一系列操作，包括修改配置、安装插件和添加机器人。

## 安装和配置插件


## 添加机器人

<!-- 现在可以对你的机器人说话了：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">echo 你好</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">你好</chat-message>
</panel-view> -->

## 添加交互逻辑

<!-- 在机器人目录中添加文件 `my-plugin.js`：

```js
// 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
module.exports = (ctx) => {
  ctx.middleware((session, next) => {
    if (session.content === '天王盖地虎') {
      session.send('宝塔镇河妖')
    }
    return next()
  })
}
```

修改你的配置文件或入口文件：

```js koishi.config.js
module.exports = {
  plugins: {
    './my-plugin': {},
  },
}
```

```js index.js
app.plugin(require('./my-plugin'))
```

然后重新运行你的项目：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">天王盖地虎</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">宝塔镇河妖</chat-message>
</panel-view> -->

## 配置数据库
