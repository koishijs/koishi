---
sidebarDepth: 2
---

# 接入 Crowdin

[Crowdin](https://crowdin.com/) 是一个专业的本地化内容管理平台，不少商业项目使用该网站翻译并管理其本地化资源。同时，该网站也为开源项目和教学项目提供了免费或优惠的许可证。当你的项目中需要翻译的字符串较多，或需要支持很多种不同的语言，那么使用专业的管理平台会十分方便。

同时，Crowdin 也不仅仅是 CAT (计算机辅助翻译)，也提供了内容管理的功能，以及多种与第三方工具集成的方案，包括与 GitHub 等代码托管平台集成。由于 Crowdin 提供了 CLI 和 API 等多种方式管理项目资源，你也可以使用 CI (Continuous Integration，持续集成) 等方式管理你的项目资源。

::: tip
除了 Crowdin，还有很多其他平台也提供类似的功能，有一些甚至是完全免费的，如：
- [Transifex](https://www.transifex.com)
- [Memsource](https://www.memsource.com/)
- [Lokalise](https://lokalise.com/)
- [POEditor](https://poeditor.com/)

你也可以尝试搜索 Translation Management System 或 Localization Platform 等关键词，整个互联网上有无数的本地化管理平台等着你去发掘。
:::

## 注册及登录 Crowdin

你可以使用邮箱注册，也可以用谷歌账号、Github 账号等登录，与其他网站异曲同工，因此此处不再赘述。

:::tip
如果你还是学生，并且成功申请了 GitHub 的学生开发包 (Student Pack)，在你使用 GitHub 账号成功登录 Crowdin 后会自动获赠价值 1500 美元的 1 年 Bronze 计划。
:::

## 创建本地化项目

成功注册并登录 Crowdin 后，你会被自动导向你的[个人页面](https://crowdin.com/profile)。点击右上角的加号，即可创建项目。

::: tip
若你的项目是开放源代码的，并且活跃了 4 个月及以上，你可以申请 Crowdin 的开源项目许可。当你成功创建项目后，填写[这个表单](https://crowdin.com/page/open-source-project-setup-request)，Crowdin 的客服人员会帮助你。
:::

在新建项目界面，需要填写项目名称 (推荐和插件或机器人的名称一致)，选择是否公开项目，设置源语言和目标语言，然后点击创建项目按钮。

:::tip
公开项目意味着所有 Crowdin 用户都能搜索到你的项目，也可以看到你的项目的所有内容，也可以向项目贡献翻译。如果你是通过开源项目免费许可的方式创建的项目，则只能创建公开项目。
:::

### 项目结构

由于 Crowdin 会将待翻译的文件名显示在项目的文件列表中，为了不引起误会，你需要为每个待翻译的文件设置一个易懂的名称。同时，要保证 Crowdin 输出的翻译结果与你的项目结构一致。

因此推荐的做法是，为每种语言建立一个独立的文件夹，然后将待翻译的文件命名为项目名称，如下所示：

```text
echo/
  |-- i18n/
      |-- en/
          |-- echo.yaml
      |-- zh-CN/
          |-- echo.yaml
  |-- index.js
  |-- package.json
```

## 上传项目文件

你可以通过网页手动上传文件，也可以通过 Crowdin 的 CLI 程序进行上传，或是使用集成让 Crowdin 直接从代码仓库同步文件。

### 手动上传

导航至 Crowdin 的内容 (Content) 界面，你可以点击上传文件 (Upload Files) 按钮上传**源语言**文件。

### 设置代码仓库集成

除了手动上传，你还可以设置集成，让 Crowdin 自动同步 GitHub 等仓库里的文件，并可设置定期推送译文到相应的分支。

你可以点击[这里](https://support.crowdin.com/github-integration/)直达 Crowdin 关于 GitHub 集成的文档。如果你使用的是 Gitlab 等其他仓库，也可以在知识库里找到相应的指南。

回到项目主页，单击集成 (Integrations) 标签页，可以为你的项目设置集成。Crowdin 支持许多集成方案，找到你所使用的代码仓库并点击。

然后，单击 Set Up Integration，连接到你的代码仓库的账户，选择你想要设置集成的仓库，选择你想要获取原文和推送译文的分支，默认情况下 Crowdin 创建一个新的分支，名为 `l10n_` 加上原分支名，如图中所示的 `l10n_master`。

![github integration connecting github](https://support.crowdin.com/assets/docs/github_integration_connecting_github.png)

![github integration unconfigured](https://support.crowdin.com/assets/docs/github_integration_unconfigured.png)

此外，你还需要点击分支名右边的编辑按钮，然后点添加文件筛选器 (Add File Filter)，在视图左边写上源文件和目标文件的模式匹配字符串之后，在右边切换并预览将会同步到 Crowdin 的文件列表，以及翻译后的文件名及其路径，你还可以添加更多的筛选器。确认添加无误后，单击 Save 按钮保存。

视图下方的 Push Source 选项默认是不勾选的，即 Crowdin 不会自动将翻译推送到仓库，打开这个选项后，Crowdin 会在对应的仓库开启一个 PR，并自动 rebase 到最新的分支，然后同步 Crowdin 上的同步到仓库。设置完成后，Crowdin 并不会自动开始同步，需要手动触发一次：点击表格右上角的 Sync Now，静待片刻即可同步完成。

### 通过 CLI 上传文件

Crowdin 还提供了一个 CLI 工具，可以通过命令行管理本地和远程的本地化资源文件。你可以通过 npm 或 yarn 安装。

```bash
$ npm i -g @crowdin/cli
$ yarn global add @crowdin/cli
```

Crowdin 也提供了 Homebrew / apt 等多种安装方式，对于 Windows 用户，你也可以直接下载 Crowdin 所提供的安装程序安装，请查看 [Crowdin 的文档](https://support.crowdin.com/cli-tool/#installation)获知更多详情。

在运行 Crowdin 的 CLI 工具之前，你需要确保当前项目的根目录下存在名为 `crowdin.yml` 的配置文件，你可以运行 `crowdin init` 创建一个基础配置文件，修改其中的条目以适应你的项目。详细的介绍可以看 [Crowdin 的文档](https://support.crowdin.com/configuration-file/)。

::: tip
`crowdin.yml` 中的配置项不仅适用于 Crowdin CLI，还可以在上述的代码仓库集成中发挥作用，Crowdin 会自动读取该文件以确定翻译的范围。
:::

推荐在项目目录下的 `crowdin.yml` 文件中配置好文件筛选器，并且在 `$HOME/.crowdin.yml` 文件中存储你的 Crowdin 密钥等敏感信息，然后你就可以简单地运行 `crowdin upload sources` 上传源文件，而不需要每次都打出冗长的包含通配符的文件路径了。

### 文件类型

Crowdin 支持许多常见文件类型，如 `HTML`、`docx`、`pdf`，本地化软件框架支持的 `xliff` 与 `po` 等自然也不在话下，如果你不确定你的文件类型是否受支持，你可以在[这里](https://support.crowdin.com/supported-formats/)查看 Crowdin 支持的文件类型列表。

作为示例，我们使用的是 `YAML` 格式的文档，Crowdin 目前仅支持纯文本的 `YAML` 格式的文档，不支持 `anchor` 等高级功能。

当然你也可以使用 `JSON` 格式，但传统的 `JSON` 无法添加注释，显示在 Crowdin 上则会缺少足够的上下文信息。因为译者在 Crowdin 上无法看到源码，也无法看到翻译后的结果的显示样式，作为开发者应当通过各种方式向译者提供详尽的上下文信息。再综合考虑 `koishi` 对 i18n 的处理方式与 Crowdin 支持的格式，采用 `YAML` 是较为经济的选择。

Crowdin 会读取 `YAML` 中的键值和注释作为该待翻译字符串的上下文。以下面的 `YAML` 为例：

```yaml
commands:
  ping:
    description: 回复 ping 信息

    options:
      # 这是一段注释
      detail: 显示网络连接情况

    messages:
      pong: PONG! # 注释也可以写在后方
```

那么在翻译界面，Crowdin 会为 `回复 ping 信息` 这一字符串添加 `commands.ping.description` 作为其上下文信息。而对于 `显示网络连接情况` 这一字符串，除了显示 `commands.ping.options.detail` 以外，还会显示 `这是一段注释` 作为其上下文信息。当然，除了写在键值的上方，你也可以写在键值后方，效果是一样的。

```yaml
commands:
  dress:
    message:
      dress: '{name}今天穿了{color}色的裙子'
```

与大部分 CAT 工具一样，Crowdin 同样会标识出诸如 `{name}` 这样的插值语法，并且在译文缺少插值或译者翻译插值变量时报告错误。

## 进行翻译

当你成功添加源文件之后，就可以着手进行翻译了。点开想要翻译的语言，打开对应文件，就可以进入 Crowdin 的在线翻译编辑器。假设你是从个人电脑打开的，那么视图会从左到右分成三个部分，左边是待翻译的字符串，中间是翻译区，右边是评论和参考区。

![crowdin online editor](https://support.crowdin.com/assets/docs/online_editor_sections.png)

如果你对该项目申请了开源项目免费许可，那么该项目还会启用 Global TM 功能。这是 Crowdin 的共享翻译语料库，可以根据其他人的项目中存在的类似文本对当前的待翻译字符串进行提示，你的项目的字符串及翻译结果也会上传到这个语料库中。

## 下载翻译

与上传翻译一样，Crowdin 提供了多种方式可以下载翻译结果，你可以直接通过网页下载单个或多个文件，也可以通过 Crowdin CLI 下载。如果你设置了与任何代码仓库的集成，并勾选了定时同步，则 Crowdin 会自动推送翻译结果到指定的分支。
