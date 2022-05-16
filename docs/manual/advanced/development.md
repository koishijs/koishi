---
sidebarDepth: 2
redirectFrom:
  - /guide/introduction/cli.html
  - /guide/introduction/development.html
  - /guide/introduction/workspace.html
---

# 工作区开发

本章节将面向 Koishi 的开发者，继续介绍模板项目的更多特性。

## 开发模式

在模板项目下运行下面的指令可以启动开发模式：

::: code-group manager
```npm
npm run dev
```
```yarn
yarn dev
```
:::

这其实相当于在 `start` 指令的基础上添加下面的参数：

```sh
-r esbuild-register
-r yml-register
--watch
```

这些参数为我们提供了额外的特性。

### TypeScript 支持

Koishi 工作区原生地支持 TypeScript 开发。上面的两组 `-r` 参数允许我们在运行时直接使用工作区插件的 TypeScript 源代码。

如果你想使用其他语言进行开发，你也可以打开 `package.json`，修改 `dev` 指令对应的脚本，向其中添加自己所需的参数：

```sh
-r coffeescript/register        # 以 CoffeeScript 为例
```

### 模块热替换

如果你开发着一个巨大的 Koishi 项目，可能光是加载一遍全部插件就需要好几秒了。在这种时候，像前端框架一样支持模块热替换就成了一个很棒的主意。Koishi 也做到了！`--watch` 参数实现了插件级别的热替换。每当你修改你的本地文件时，Koishi 就会尝试重载你的插件，并在控制台提醒你。

这里的行为也可以在配置文件中进行定制：

```yaml title=koishi.yml
watch:
  # 要忽略的文件列表，支持 glob patterns
  ignore:
    - some-file
```

<!-- 此外，这个指令还支持一些额外的配置项：

- **--log-level:** 控制输出等级
- **--log-time:** 在日志中显示时间
- **--debug:** 最高等级输出的命名空间

与输出日志相关的选项请参见 [输出与日志](../service/logger.md) 一章。 -->

## 插件开发

下面将介绍如何使用模板项目编写、构建和发布自己的 Koishi 插件。

### 创建新插件

::: code-group manager
```npm
npm run setup [name] [-c]
```
```yarn
yarn setup [name] [-c]
```
:::

上述指令将创建一个新的插件工作区。

- **name:** 插件的包名，缺省时将进行提问
- **-c, --console:** 创建一个带控制台扩展的插件

我们假设你创建了一个叫 `demo` 的插件。那么，你将看到下面的目录结构：

```
root
├── plugins
│   └── demo
│       ├── src
│       │   └── index.ts
│       └── package.json
├── koishi.yml
└── package.json
```

打开 `index.ts` 文件，并修改其中的代码：

```ts no-extra-header
import { Context } from 'koishi'

export const name = 'demo'

export function apply(ctx: Context) {
  ctx.middleware((session, next) => {
    if (session.content === '天王盖地虎') {
      return '宝塔镇河妖'
    }
    return next()
  })
}
```

以开发模式重新运行你的项目，你会立即在网页控制台的配置界面中看到 `demo` 插件。只需点击启用，你就可以实现与机器人的对话了：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">天王盖地虎</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">宝塔镇河妖</chat-message>
</panel-view>

### 构建源代码

在插件正式发布前，你需要将插件的源代码构建为 js 文件。

::: code-group manager
```npm
npm run build [...folder]
```
```yarn
yarn build [...folder]
```
:::

上述指令按依赖顺序构建插件相关的源代码，包括后端 + 前端。

- **folder:** 要构建的插件列表，缺省时表示全部

还是以上面的插件 `demo` 为例：

- 后端代码将输出到 `plugins/foo/lib` 目录
- 前端代码将输出到 `plugins/foo/dist` 目录 (如果存在)

### 更新版本号

::: code-group manager
```npm
npm run bump [...folder] [-1|-2|-3|-p|-v <ver>] [-r]
```
```yarn
yarn bump [...folder] [-1|-2|-3|-p|-v <ver>] [-r]
```
:::

上述指令将更新某些插件的版本号。当进行此操作时，其他相关插件的依赖版本也会同步更新，确保所有工作区内依赖的插件版本一致。

- **folder:** 要发布的插件列表，不能为空
- 版本选项：
  - **-1, --major:** 跳到下一个大版本，例如 `3.1.4` -> `4.0.0`
  - **-2, --minor:** 跳到下一个中版本，例如 `3.1.4` -> `3.2.0`
  - **-3, --patch:** 跳到下一个小版本，例如 `3.1.4` -> `3.1.5`
  - **-p, --prerelease:** 跳到下一个预览版本，具体行为如下
    - 如果当前版本是 `alpha.x`，则跳到 `beta.0`
    - 如果当前版本是 `beta.x`，则跳到 `rc.0`
    - 如果当前版本是 `rc.x`，则移除 prerelease 部分
    - 其他情况下，跳到下一个大版本的 `alpha.0`
  - **-v, --version:** 设置具体的版本号
  - 缺省情况：当前版本的最后一位递增
- 其他选项：
  - **-r, --recursive:** 当更新一个插件的版本时，依赖其的插件也随时更新版本
  <!-- - -s, --sync: 与云端进行同步，基于 npm 上的最新版本而非本地版本更新 -->

### 更新依赖

尽管 npm 和 yarn 等包管理器都提供了依赖更新功能，但它们对工作区开发的支持都不是很好。因此，我们也提供了一个简单的指令用于批量更新依赖版本。

::: code-group manager
```npm
npm run dep
```
```yarn
yarn dep
```
:::

上述指令会按照每个 `package.json` 中声明的依赖版本进行更新。举个例子，如果某个依赖的版本是 `^1.1.4`，而这个依赖之后发布了新版本 `1.2.3` 和 `2.3.3`，那么运行该指令后，依赖的版本将会被更新为 `^1.2.3`。

### 发布插件

::: code-group manager
```npm
npm run publish [...folder]
```
```yarn
yarn publish [...folder]
```
:::

上述指令将发布所有版本号发生变动的插件。

- **folder:** 要发布的插件列表，缺省时表示全部
