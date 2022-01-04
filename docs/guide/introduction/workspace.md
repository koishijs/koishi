---
sidebarDepth: 2
---

# 工作区开发

::: tip
本章介绍的内容本质上与 Koishi 无关，只是提供了一套推荐的插件开发流程。如果你有其他希望分享给大家的工作流程，欢迎前往讨论区或 Discord 进行分享。
:::

如果你希望同时开发插件和自己的机器人，并随时进行联合调试，那么工作区将会是你的首选。

## 建立工作区

```
root
├── plugins
│   └── aircon
│       ├── src
│       │   └── index.js
│       └── package.json
├── src
│   └── ping.js
├── .gitignore
├── koishi.config.yml
└── package.json
```

同时修改根目录下的 package.json，配置工作区：

```json package.json
{
  "name": "root",
  "private": true,
  "version": "1.0.0",
  "workspaces": [
    "plugins"
  ],
  "scripts": {
    "start": "koishi start"
  }
}
```

下面将介绍几种常见的工作区配置方式，请根据自己的需要进行选择。

## 单仓库

如果你希望同单个公开仓库将所有插件开源，但是不希望暴露你机器人的配置文件和部分逻辑。下面是供参考的 .gitignore 文件：

```
koishi.config.yml
src
```

最后别忘了给你的仓库加上一个 readme 文件，告诉大家这里有哪些插件。

## 多仓库 (npm)

如果你想要独立地将所有插件开源到不同的公开仓库，同时希望将你机器人整体作为私人仓库进行维护，那么下面是供参考的 .gitignore 文件：

```
plugins
```

当你修改机器人逻辑或发布插件后，你可以在服务器拉取私人仓库，并将机器人的插件更新到最新版本后启动。

## 多仓库 (submodule)

另一种方法是将插件独立地开源，并将其作为子模块添加到机器人仓库中。

```sh
git submodule add https://github.com/username/koishi-plugin-aircon.git plugins/aircon
```

## 使用 TypeScript
