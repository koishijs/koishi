<div align="center">
  <a href="https://koishi.js.org/" target="_blank">
    <img width="160" src="https://koishi.js.org/koishi.png" alt="logo">
  </a>
  <h1 id="koishi"><a href="https://koishi.js.org/" target="_blank">Koishi</a></h1>

[![Codecov](https://img.shields.io/codecov/c/github/koishijs/koishi?style=flat-square)](https://codecov.io/gh/koishijs/koishi)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/koishijs/koishi.svg?style=flat-square)](https://lgtm.com/projects/g/koishijs/koishi/context:javascript)
[![npm](https://img.shields.io/npm/v/koishi?style=flat-square)](https://www.npmjs.com/package/koishi)
[![GitHub](https://img.shields.io/github/license/koishijs/koishi?style=flat-square)](https://github.com/koishijs/koishi/blob/master/LICENSE)

</div>

Koishi 是一个在 [Node.js](https://nodejs.org/) 环境下运行的机器人框架，目前支持 [CQHTTP (OneBot)](https://github.com/howmanybots/onebot) 协议，未来也将支持更多平台。

这个项目的名字和图标来源于东方 Project 中的角色古明地恋 (Komeiji Koishi)。

![demo](./.github/demo.png)

## 安装

```sh
# 进入文件夹
cd my-bot

# 安装 Koishi
npm i koishi

# 初始化配置文件
koishi init

# 运行你的 Bot
koishi run
```

现在可以对你的机器人说话了：

```sh
> echo hello world
< hello world
```

**注意:** Koishi 要求您的 Node.js 的版本不小于 12。

## 应用案例

| 项目地址 | <span align="center">简介</span> |
|:-:|:-:|
| [masnn/qqbot](https://github.com/masnn/qqbot) | 没想好（ |

欢迎[向上表中添加](https://github.com/koishijs/koishi/edit/master/README.md)自己的机器人。

## 平台支持

### [koishi-adapter-cqhttp](./packages/adapter-cqhttp) [![npm](https://img.shields.io/npm/v/koishi-adapter-cqhttp?style=flat-square)](https://www.npmjs.com/package/koishi-adapter-cqhttp)

[CQHTTP (OneBot)](https://github.com/howmanybots/onebot) 协议支持，可与下列实现该协议的框架完美对接：

- [richardchien/coolq-http-api](https://github.com/richardchien/coolq-http-api)
- [Mrs4s/go-cqhttp](https://github.com/Mrs4s/go-cqhttp)
- [yyuueexxiinngg/cqhttp-mirai](https://github.com/yyuueexxiinngg/cqhttp-mirai)

## 数据库支持

### [koishi-plugin-mongo](./packages/plugin-mongo) [![npm](https://img.shields.io/npm/v/koishi-plugin-mongo?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-mongo)

MongoDB 支持。

### [koishi-plugin-mysql](./packages/plugin-mysql) [![npm](https://img.shields.io/npm/v/koishi-plugin-mysql?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-mysql)

MySQL 5.7 支持。

## 官方插件

### [koishi-plugin-chess](./packages/plugin-chess) [![npm](https://img.shields.io/npm/v/koishi-plugin-chess/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chess)

### [koishi-plugin-common](./packages/plugin-common) [![npm](https://img.shields.io/npm/v/koishi-plugin-common/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-common)

### [koishi-plugin-eval](./packages/plugin-eval) [![npm](https://img.shields.io/npm/v/koishi-plugin-eval/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-eval)

### [koishi-plugin-eval-addons](./packages/plugin-eval-addons) [![npm](https://img.shields.io/npm/v/koishi-plugin-eval-addons/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-eval-addons)

### [koishi-plugin-github](./packages/plugin-github) [![npm](https://img.shields.io/npm/v/koishi-plugin-github/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-github)

### [koishi-plugin-image-search](./packages/plugin-image-search) [![npm](https://img.shields.io/npm/v/koishi-plugin-image-search?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-image-search)

### [koishi-plugin-monitor](./packages/plugin-monitor) [![npm](https://img.shields.io/npm/v/koishi-plugin-monitor/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monitor)

### [koishi-plugin-puppeteer](./packages/plugin-puppeteer) [![npm](https://img.shields.io/npm/v/koishi-plugin-puppeteer?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-puppeteer)

### [koishi-plugin-recorder](./packages/plugin-recorder) [![npm](https://img.shields.io/npm/v/koishi-plugin-recorder/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-recorder)

### [koishi-plugin-rss](./packages/plugin-rss) [![npm](https://img.shields.io/npm/v/koishi-plugin-rss?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-rss)

### [koishi-plugin-schedule](./packages/plugin-schedule) [![npm](https://img.shields.io/npm/v/koishi-plugin-schedule?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-schedule)

### [koishi-plugin-status](./packages/plugin-status) [![npm](https://img.shields.io/npm/v/koishi-plugin-status/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-status)

### [koishi-plugin-teach](./packages/plugin-teach) [![npm](https://img.shields.io/npm/v/koishi-plugin-teach?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-teach)

### [koishi-plugin-tools](./packages/plugin-tools) [![npm](https://img.shields.io/npm/v/koishi-plugin-tools?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-tools)

## 支持作者

<img src="./.github/wechat.png" alt="wechat" width="320">
