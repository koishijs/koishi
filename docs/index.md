---
home: true
heroImage: /koishi.png
heroText: Koishi
tagline: 一个跨平台的机器人框架
actions:
  - text: 快速上手 →
    link: /guide/starter.html
    type: primary
features:
  - title: 开箱即用
    details: 高度便利的 CLI 和 API 可以让你无需基础在几分钟之内搭建自己的机器人。
  - title: 功能强大
    details: 中间件，指令系统，插件系统，数据库，跨平台……它们可以让你顺利实现任何需求。
  - title: 生态丰富
    details: 官方提供了大量插件和解决方案，在满足各种需求的同时，也为开发提供了绝佳的范例。
footer: MIT Licensed | Copyright © 2019-present Shigma
---

::: code-group manager
```npm
# 创建并进入文件夹
mkdir my-bot && cd my-bot

# 安装 Koishi
npm i koishi -D

# 初始化配置文件
npx koishi init

# 安装插件
npm i

# 运行你的 Bot
npx koishi start
```
```yarn
# 创建并进入文件夹
mkdir my-bot && cd my-bot

# 安装 Koishi
yarn add koishi -D

# 初始化配置文件
yarn koishi init

# 安装插件
yarn

# 运行你的 Bot
yarn koishi start
```
:::

现在可以对你的机器人说话了：

<panel-view :messages="[
  ['Alice', 'echo 你好'],
  ['Koishi', '你好'],
]"/>
