<div align="center">
  <a href="https://koishi.js.org/" target="_blank">
    <img width="160" src="https://koishi.js.org/koishi.png" alt="logo">
  </a>
  <h1 id="koishi"><a href="https://koishi.js.org/" target="_blank">Koishi</a></h1>

[![npm](https://img.shields.io/npm/v/koishi/next?style=flat-square)](https://www.npmjs.com/package/koishi)
[![GitHub](https://img.shields.io/github/license/koishijs/koishi?style=flat-square)](https://github.com/koishijs/koishi/blob/master/LICENSE)

</div>

Koishi 是一个在 [Node.js](https://nodejs.org/) 环境下运行的 QQ 机器人框架，目前支持 [CQHTTP](https://cqhttp.cc) 及其扩展协议，未来也将支持更多平台。

这个项目的名字和图标来源于东方 Project 中的角色古明地恋（Komeiji Koishi）。

## 安装

```sh
# 进入文件夹
cd my-bot

# 安装 Koishi
npm i koishi@next -g

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

**注意:** Koishi 要求您的 Node.js 的版本不小于 10，CQHTTP 的版本不小于 4.0。过低的 CQHTTP 版本将不会支持 Koishi 的某些功能。因此，我们建议您保持较新的 CQHTTP 版本以确保所有功能可用。

## 最新版本

| 包名 | 版本 |
|:-:|:-:|
| [koishi](https://github.com/koishijs/koishi/tree/master/packages/koishi) | [![npm](https://img.shields.io/npm/v/koishi/next?style=flat-square)](https://www.npmjs.com/package/koishi) |
| [koishi-core](https://github.com/koishijs/koishi/tree/master/packages/koishi-core) | [![npm](https://img.shields.io/npm/v/koishi-core/next?style=flat-square)](https://www.npmjs.com/package/koishi-core) |
| [koishi-utils](https://github.com/koishijs/koishi/tree/master/packages/koishi-utils) | [![npm](https://img.shields.io/npm/v/koishi-utils?style=flat-square)](https://www.npmjs.com/package/koishi-utils) |
| [koishi-test-utils](https://github.com/koishijs/koishi/tree/master/packages/test-utils) | [![npm](https://img.shields.io/npm/v/koishi-test-utils/next?style=flat-square)](https://www.npmjs.com/package/koishi-test-utils) |
| [koishi-plugin-chess](https://github.com/koishijs/koishi/tree/master/packages/plugin-chess) | [![npm](https://img.shields.io/npm/v/koishi-plugin-chess/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chess) |
| [koishi-plugin-common](https://github.com/koishijs/koishi/tree/master/packages/plugin-common) | [![npm](https://img.shields.io/npm/v/koishi-plugin-common/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-common) |
| [koishi-plugin-github-webhook](https://github.com/koishijs/koishi/tree/master/packages/plugin-github-webhook) | [![npm](https://img.shields.io/npm/v/koishi-plugin-github-webhook?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-github-webhook) |
| [koishi-plugin-image-search](https://github.com/koishijs/koishi/tree/master/packages/plugin-image-search) | [![npm](https://img.shields.io/npm/v/koishi-plugin-image-search?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-image-search) |
| [koishi-plugin-monitor](https://github.com/koishijs/koishi/tree/master/packages/plugin-monitor) | [![npm](https://img.shields.io/npm/v/koishi-plugin-monitor/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monitor) |
| [koishi-plugin-mysql](https://github.com/koishijs/koishi/tree/master/packages/plugin-mysql) | [![npm](https://img.shields.io/npm/v/koishi-plugin-mysql?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-mysql) |
| [koishi-plugin-puppeteer](https://github.com/koishijs/koishi/tree/master/packages/plugin-puppeteer) | [![npm](https://img.shields.io/npm/v/koishi-plugin-puppeteer/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-puppeteer) |
| [koishi-plugin-recorder](https://github.com/koishijs/koishi/tree/master/packages/plugin-recorder) | [![npm](https://img.shields.io/npm/v/koishi-plugin-recorder/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-recorder) |
| [koishi-plugin-schedule](https://github.com/koishijs/koishi/tree/master/packages/plugin-schedule) | [![npm](https://img.shields.io/npm/v/koishi-plugin-schedule/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-schedule) |
| [koishi-plugin-status](https://github.com/koishijs/koishi/tree/master/packages/plugin-status) | [![npm](https://img.shields.io/npm/v/koishi-plugin-status/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-status) |
| [koishi-plugin-teach](https://github.com/koishijs/koishi/tree/master/packages/plugin-teach) | [![npm](https://img.shields.io/npm/v/koishi-plugin-teach/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-teach) |
| [koishi-plugin-tools](https://github.com/koishijs/koishi/tree/master/packages/plugin-tools) | [![npm](https://img.shields.io/npm/v/koishi-plugin-tools?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-tools) |
| [koishi-plugin-vm](https://github.com/koishijs/koishi/tree/master/packages/plugin-vm) | [![npm](https://img.shields.io/npm/v/koishi-plugin-vm/next?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-vm) |

## 支持项目作者

<img src="./.github/wechat.png" alt="wechat" width="320">
