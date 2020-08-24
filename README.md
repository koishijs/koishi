<div align="center">
  <a href="https://koishi.js.org/" target="_blank">
    <img width="160" src="https://koishi.js.org/koishi.png" alt="logo">
  </a>
  <h1 id="koishi"><a href="https://koishi.js.org/" target="_blank">Koishi</a></h1>

[![npm](https://img.shields.io/npm/v/koishi/next?style=flat-square)](https://www.npmjs.com/package/koishi)
[![GitHub](https://img.shields.io/github/license/koishijs/koishi?style=flat-square)](https://github.com/koishijs/koishi/blob/master/LICENSE)

</div>

Koishi 是一个在 [Node.js](https://nodejs.org/) 环境下运行的机器人框架，目前支持 [CQHTTP/OneBot](https://cqhttp.cc) 协议，未来也将支持更多平台。

这个项目的名字和图标来源于东方 Project 中的角色古明地恋（Komeiji Koishi）。

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

## 最新版本

| 包名 | 版本 |
|:-:|:-:|
| [koishi](./packages/koishi) | [![npm](https://img.shields.io/npm/v/koishi/next?style=flat-square)](https://www.npmjs.com/package/koishi) |
| [koishi-core](./packages/koishi-core) | [![npm](https://img.shields.io/npm/v/koishi-core/next?style=flat-square)](https://www.npmjs.com/package/koishi-core) |
| [koishi-utils](./packages/koishi-utils) | [![npm](https://img.shields.io/npm/v/koishi-utils?style=flat-square)](https://www.npmjs.com/package/koishi-utils) |
| [koishi-test-utils](./packages/test-utils) | [![npm](https://img.shields.io/npm/v/koishi-test-utils/next?style=flat-square)](https://www.npmjs.com/package/koishi-test-utils) |
| [koishi-adapter-cqhttp](./packages/adapter-cqhttp) | [![npm](https://img.shields.io/npm/v/koishi-adapter-cqhttp/next?style=flat-square)](https://www.npmjs.com/package/koishi-adapter-cqhttp) |
| [koishi-plugin-chess](./packages/plugin-chess) | [![npm](https://img.shields.io/npm/v/koishi-plugin-chess/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chess) |
| [koishi-plugin-common](./packages/plugin-common) | [![npm](https://img.shields.io/npm/v/koishi-plugin-common/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-common) |
| [koishi-plugin-eval](./packages/plugin-eval) | [![npm](https://img.shields.io/npm/v/koishi-plugin-eval/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-eval) |
| [koishi-plugin-eval-addons](./packages/plugin-eval-addons) | [![npm](https://img.shields.io/npm/v/koishi-plugin-eval-addons/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-eval-addons) |
| [koishi-plugin-github](./packages/plugin-github) | [![npm](https://img.shields.io/npm/v/koishi-plugin-github/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-github) |
| [koishi-plugin-image-search](./packages/plugin-image-search) | [![npm](https://img.shields.io/npm/v/koishi-plugin-image-search/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-image-search) |
| [koishi-plugin-mongo](./packages/plugin-mongo) | [![npm](https://img.shields.io/npm/v/koishi-plugin-mongo/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-mongo) |
| [koishi-plugin-monitor](./packages/plugin-monitor) | [![npm](https://img.shields.io/npm/v/koishi-plugin-monitor/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monitor) |
| [koishi-plugin-mysql](./packages/plugin-mysql) | [![npm](https://img.shields.io/npm/v/koishi-plugin-mysql/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-mysql) |
| [koishi-plugin-puppeteer](./packages/plugin-puppeteer) | [![npm](https://img.shields.io/npm/v/koishi-plugin-puppeteer/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-puppeteer) |
| [koishi-plugin-recorder](./packages/plugin-recorder) | [![npm](https://img.shields.io/npm/v/koishi-plugin-recorder/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-recorder) |
| [koishi-plugin-rss](./packages/plugin-rss) | [![npm](https://img.shields.io/npm/v/koishi-plugin-rss/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-rss) |
| [koishi-plugin-schedule](./packages/plugin-schedule) | [![npm](https://img.shields.io/npm/v/koishi-plugin-schedule/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-schedule) |
| [koishi-plugin-status](./packages/plugin-status) | [![npm](https://img.shields.io/npm/v/koishi-plugin-status/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-status) |
| [koishi-plugin-teach](./packages/plugin-teach) | [![npm](https://img.shields.io/npm/v/koishi-plugin-teach/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-teach) |
| [koishi-plugin-tools](./packages/plugin-tools) | [![npm](https://img.shields.io/npm/v/koishi-plugin-tools/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-tools) |

## 支持项目作者

<img src="./.github/wechat.png" alt="wechat" width="320">
