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

## 插件开发

若非额外说明，下面示例中的 `name` 均指插件的目录名而非包名。例如你在 `plugins/foo` 目录下有一个名为 `@bar/foo` 的插件，则构建此插件时你仍然只需要写 `npm run build foo`。

### 创建新插件

```sh
npm run create [name]
```

创建一个新的插件工作区。

- name: 插件的短名或包名，缺省时将进行提问

### 构建源代码

```sh
npm run build [...name]
```

按依赖顺序构建插件相关的源代码，包括后端 + 前端。后端代码将输出到 `lib` 目录，前端代码将输出到 `dist` 目录。

- name: 要构建的插件列表，输入 `*` 或缺省时都表示全部

### 更新版本号

```sh
npm run bump [...name] [-1|-2|-3|-p|-v <ver>] [-r] [-s]
```

更新某些插件的版本号。当进行此操作时，其他相关插件的依赖版本也会同步更新，确保所有工作区内依赖的插件版本一致。

- name: 要发布的插件列表，输入 `*` 表示全部，缺省时无效果
- 版本选项：
  - -1, --major: 跳到下一个大版本，例如 `3.1.4` -> `4.0.0`
  - -2, --minor: 跳到下一个中版本，例如 `3.1.4` -> `3.2.0`
  - -3, --patch: 跳到下一个小版本，例如 `3.1.4` -> `3.1.5`
  - -p, --prerelease: 跳到下一个预览版本，具体行为如下
    - 如果当前版本是 `alpha.x`，则跳到 `beta.0`
    - 如果当前版本是 `beta.x`，则跳到 `rc.0`
    - 如果当前版本是 `rc.x`，则移除 prerelease 部分
    - 其他情况下，跳到下一个大版本的 `alpha.0`
  - -v, --version: 设置具体的版本号
  - 缺省情况：当前版本的最后一位递增
- 其他选项：
  - -r, --recursive: 当更新一个插件的版本时，依赖其的插件也随时更新版本
  - -s, --sync: 与云端进行同步，基于 npm 上的最新版本而非本地版本更新

### 发布插件

```sh
npm run publish [...name]
```

发布所有版本号发生变动的插件。

- name: 要发布的插件列表，输入 `*` 或缺省时都表示全部
