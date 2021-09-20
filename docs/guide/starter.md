---
sidebarDepth: 2
---

# 快速上手

## 准备工作

Koishi 需要 [NodeJS](https://nodejs.org/) (v12 以上) 运行环境，你需要自己安装它。同时，我们还强烈建议您安装 [yarn](https://classic.yarnpkg.com/lang/en/) 作为包管理器。在下面的文档中，我们将默认使用 yarn。

Koishi 支持多个聊天平台，对于不同的平台，你也需要做好相应的准备工作。

### [OneBot (QQ)](../api/adapter/onebot.md)

[OneBot](https://github.com/howmanybots/onebot) 是一个聊天机器人应用接口标准，目前可用于 QQ 聊天机器人的实现。你可以使用下列实现该协议的框架：

- [Mrs4s/go-cqhttp](https://github.com/Mrs4s/go-cqhttp)（推荐, 并使用 [WebSocket配置](../api/adapter/onebot.md#websocket)）
- [yyuueexxiinngg/cqhttp-mirai](https://github.com/yyuueexxiinngg/cqhttp-mirai)
- [richardchien/coolq-http-api](https://github.com/richardchien/coolq-http-api)（配合 [iTXTech/mirai-native](https://github.com/iTXTech/mirai-native) 使用）

### [Telegram (Telegram)](../api/adapter/telegram.md)

1. 搜索 @botfather（有个官方认证的符号）并进入聊天界面
2. 输入 `/start` 后，会出现一个使用菜单，你可以使用这里指令对你的机器人进行配置
3. 要创建一个机器人，请点击 `/newbot`，并根据系统提示完成创建流程
4. 使用 `/setprivacy` 开启 Privacy Mode（不然机器人只能收到特定消息）
5. 创建完毕后，你会获得一个 token（请注意不要泄露），将其作为机器人配置项即可使用

参考文档：[https://core.telegram.org/bots](https://core.telegram.org/bots)

### [Discord (Discord)](../api/adapter/discord.md)

1. 前往 [https://discord.com/developers/applications](https://discord.com/developers/applications)，登录账号创建一个应用
2. 点击「Bot」并创建一个新的机器人，保存这个页面中的 token（请注意不要泄露）
3. 要将机器人拉进你的服务器，点击「OAuth2」，并在网址生成器中勾选 Bot 和机器人所需要的权限
4. 打开生成的链接，选择你具有管理权限的服务器，就成功把机器人添加进去了
5. 将上面的 token 作为机器人配置项即可使用

### [开黑啦 (Kaiheila)](../api/adapter/kaiheila.md)

1. 前往 [开发者平台](https://developer.kaiheila.cn/)，选择「机器人」并点击「新建」
2. 在机器人连接模式中配置 Webhook 或 WebSocket 中的一种：
    - 如果是 Webhook，请记下页面中的 token 和 verify_token，并作为机器人的配置项，同时让 Koishi 暴露一个 URL，填入下方的 Callback URL 中，启动 Koishi 后点击「机器人上线」
    - 如果是 WebSocket，则只需记录 token 并作为机器人的配置项即可，你可以在任何时候启动 Koishi
    - 页面中的其他值不用管，但请注意 token 不要泄露

## 使用命令行工具

创建并进入一个机器人目录：

```cli
mkdir my-bot && cd my-bot
```

然后输入下面的命令行，生成配置文件的设置将在下方说明：

::: code-group manager
```npm
# 初始化项目
npm init

# 安装 koishi
npm i koishi -D

# 生成配置文件，注意这里是 npx 而不是 npm
npx koishi init

# 补全依赖
npm i
```
```yarn
# 初始化项目
yarn init

# 安装 koishi
yarn add koishi -D

# 生成配置文件
yarn koishi init

# 补全依赖
yarn
```
:::

**Adapter Type:** 此处可根据你所需要的平台进行选择, 在[准备工作](./starter.md#准备工作)有详细说明

**Koishi Port:** 一般情况保持默认即可, 确保不要与其他端口冲突(如 Vue CLI 项目)

**Token for XXX Server / XXX Server / Secret for Koishi Server:** 根据实际情况填写。

**configurate another bot?** 如有多个机器人, 可在此一并设置, 一般默认即可。

**Database Type:** 为了确保体验的完整性（如[用户系统](./manage.md)及大部分官方/社区插件, 强烈建议在此配置数据库。

**Choose Offical Plugins:** 在此选择一并安装的官方插件列表, 详情介绍参见[官方插件页面](../plugins/index.md)。选择后继续回车即可。

此时，你会看到在你刚刚创建的目录下多了一些文件，包括 `package.json` 和 `koishi.config.js`。后者应该大概长这样：

```js koishi.config.js
module.exports = {
  // 协议类型
  type: 'onebot:http',
  // 机器人自己的账号
  selfId: '123456789',
  // 插件列表
  plugins: {
    common: {},
  },
}
```

最后运行程序：

::: code-group manager
```npm
npx koishi start
```
```yarn
yarn koishi start
```
:::

现在可以对你的机器人说话了：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">echo 你好</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">你好</chat-message>
</panel-view>

## 通过脚本调用 Koishi

如果你对 JavaScript 和 Node.js 非常熟悉，你或许也希望在 Node.js 中直接调用 Koishi——没问题，我们也提供了这样一套方案。

首先初始化你的机器人目录并安装 Koishi 和所需的插件（这里以 koishi-adapter-onebot 和 koishi-plugin-common 为例）：

::: code-group manager
```npm
# 初始化项目
npm init

# 安装 koishi 和相关库
npm i koishi koishi-adapter-onebot koishi-plugin-common -D
```
```yarn
# 初始化项目
yarn init

# 安装 koishi 和相关库
yarn add koishi koishi-adapter-onebot koishi-plugin-common -D
```
:::

新建入口文件 `index.js`，并写下这段代码：

```js index.js
const { App } = require('koishi')

// 你需要手动安装适配器
require('koishi-adapter-onebot')

const app = new App({
  // 这部分与上面的配置文件作用基本相同
  type: 'onebot:http',
  selfId: '123456789',
})

// 注册插件，作用相当于上面配置文件中的 plugins 部分
app.plugin(require('koishi-plugin-common'))

// 启动应用
app.start()
```

上面的配置项参见 [App 的构造函数选项](../api/app.md#构造函数选项)。

最后运行这个文件：

```cli
node .
```

这样也能运行你的机器人。尽管这显得稍微麻烦一点，但是你的机器人也因此获得了更高的自由度。在下一章我们会简单对比这两种方法。

## 使用 Docker

Koishi 还支持在 Docker 中运行，你需要安装 [Docker](https://www.docker.com)，但不必安装有 NodeJS。

首先创建如下的配置文件：

```js koishi.config.js
module.exports = {
  bots: [],
}
```

完成之后，挂载 `koishi.config.js` 并启动容器：

```cli
docker run -d --name koishi \
  -v $PWD/koishi.config.js:/app/koishi.config.js \
  koishijs/koishi:latest
```

Koishi 启动后，你就可以在容器中安装所需要的插件，具体操作请参见 [使用 Docker](./docker.md) 一章。

## 编写并调用你的插件

在机器人目录中添加文件 `my-plugin.js`：

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
</panel-view>

## 配置数据库

## 配置多机器人

你可以像这样使用多个机器人：

```js koishi.config.js
module.exports = {
  port: 7070,
  onebot: {
    // onebot 服务将在 http://localhost:7070/onebot 进行处理
    path: '/event',
    secret: 'my-secret',
  },
  kaiheila: {
    // kaiheila 服务将在 http://localhost:7070/kaiheila 进行处理
    path: '/kaiheila',
  },
  bots: [
    // 在这里写上不同的机器人配置
    { type: 'onebot:http', selfId: '123456789', server: 'http://onebot-server' },
    { type: 'onebot:ws', selfId: '987654321', token: 'my-onebot-token' },
    { type: 'kaiheila:ws', selfId: 'aAbBcCdD', token: 'my-kaiheila-token' },
  ],
}
```

运行程序后，Koishi 将同时登陆三个机器人。有关多机器人的详细使用方法，可以参见 [**多账户与跨平台**](./adapter.md) 一章。
