---
sidebarDepth: 2
---

# 创建模板项目

本章将介绍我们最推荐的 Koishi 上手方案——创建模板项目。

::: tip
Koishi 需要 [NodeJS](https://nodejs.org/) (最低 v12，推荐使用 LTS) 运行环境，你需要自己安装它。
:::

## 初始化项目

我们提供了两种创建方法。你可以使用其中的任意一种。

### 从模板仓库创建

访问模板仓库需要你有一个 [GitHub](https://github.com/) 账号。我们假设你已经处于登录状态。

1. 点击 [这里](https://github.com/koishijs/boilerplate/generate) 以创建此仓库的副本。
    <br>注意：创建副本不同于 fork，它生成的新仓库不会包含当前仓库的提交历史。
2. 将你创建的项目 clone 到本地，并在本地目录启动命令行。
3. 输入 `npm install` / `yarn` 安装依赖。
4. 输入 `npm start` / `yarn start` 开始运行。

### 使用包管理器创建

在任意目录启动命令行，输入下面的指令：

::: code-group manager
```npm
npm init koishi
```
```yarn
yarn create koishi
```
:::

跟随提示即可完成全套初始化流程。

:::: tip
由于国内可能无法访问 GitHub，你可能需要科学上网或使用镜像。例如你可以使用 [FastGit](http://fastgit.org/) 作为镜像源，只需在上面的脚本后添加 `-m https://hub.fastgit.xyz` 即可。
::::

### 启动应用

如果你顺利完成了上一步操作，你的应用此时应该已经是启动状态，你无需进行额外的操作。但当应用处于关闭状态时，你可以在运行下面的指令以启动：

::: code-group manager
```npm
npm start
```
```yarn
yarn start
```
:::

<!-- ### 自动重启 <badge text="beta" type="warning"/>

Koishi 的命令行工具支持自动重启。当运行 Koishi 的进程崩溃时，如果 Koishi 已经启动成功，则监视进程将自动重新启动一个新的进程。

同时，你也可以通过指令手动进行重启：

<panel-view :messages="[
  ['Alice', 'exit -r'],
  ['Koishi', '正在重启……'],
  ['Koishi', '重启完成。'],
]"/> -->

## 使用控制台

项目启动成功后，会自动为你打开一个浏览器界面。你可以使用界面中的控制台进行一系列操作，包括修改配置、安装插件和添加机器人等。

### 安装和配置插件

1. 在控制台中点击「插件市场」，你将在这里看到所有支持当前版本的插件。

![](/console/market.png)

2. 我们分别找到 echo 和 sandbox 两个插件，点击「添加」按钮，插件就被加入了当前依赖。

![](/console/market-search.png)

3. 前往「依赖管理」页面，你可以在这里看到依赖列表，点击「更新依赖」按钮，即可完成下载。

![](/console/dependencies.png)

4. 现在前往「插件配置」页面，你会发现这两个插件已经被添加但是尚未运行。分别点击「启用插件」按钮，插件即可开始工作。

![](/console/settings-enable.png)

5. echo 插件的功能是提供一个 echo 指令，它会将用户的输入原样输出给用户；而 sandbox 插件的功能则是在控制台中新增一个界面「沙盒」，你可以在其中模拟与机器人的对话 (当你启用这个插件时，你立即可以看到它)。现在前往沙盒页面，与机器人聊天吧！

![](/console/sandbox.png)

### 接入聊天平台

Koishi 支持多个聊天平台，对于不同的平台，你也需要做好相应的准备工作。

- [Discord](../../plugins/adapter/discord.md)
- [开黑啦](../../plugins/adapter/kaiheila.md)
- [OneBot](../../plugins/adapter/onebot.md)
- [QQ 频道](../../plugins/adapter/qqguild.md)
- [Telegram](../../plugins/adapter/telegram.md)

1. 前往「机器人」页面，点击「添加机器人」，在表单中选择适配器和协议。
2. 完成剩下的配置项 (具体请参考对应平台的接入指南)。
3. 点击「登录账号」，你的机器人就已经开始运行了。
4. 如果发现没有你想要的适配器，可以前往「插件市场」中进行安装。

### 配置更多服务

## 了解配置文件

### 使用配置文件

打开你创建的目录，你会发现有一个 `koishi.config.yml` 文件。它大概长这样：

```yaml title="koishi.config.yml"
port: 8080

plugins:
  console:
    open: true
  dataview:
  logger:
  manager:
  status:
```

你在设置界面进行的操作最终都会写入这个文件。因此，你也可以选择直接修改这个文件并重新运行项目，效果同你修改配置文件是一样的。`plugins` 字段保存了各个插件的配置，其中以 `~` 字符开头的插件不会启动。其余的字段都是全局配置。

### 使用环境变量

你可以通过插值语法在配置文件中使用环境变量。例如：

```yaml title="koishi.config.yml"
plugins:
  adapter-discord:
    bots:
      - token: ${{ env.DISCORD_TOKEN }}
```

当项目启动时，会将环境变量中的值替换进去。

除了系统提供的环境变量外，Koishi 还支持 [dotenv](https://github.com/motdotla/dotenv)。你可以在当前目录创建一个 `.env` 文件，并在里面填写你的环境变量。这个文件已经被包含在 `.gitignore` 中，你可以在其中填写隐私信息（例如账号密码）而不用担心被上传到远端。

## 下一步该做什么

恭喜你已经学会了 Koishi 的基本使用方法！接下来：

- 如果你想继续学习 Koishi 的开发，请继续阅读指南中剩余的内容
- 如果你想了解更多的插件以便快速搭建成熟的项目，请前往 [官方插件](../../plugins/) 部分
