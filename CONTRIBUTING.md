# 贡献指南

:tada: 首先，感谢你抽出宝贵的时间向 Koishi 贡献，正是因为有像你一样的贡献者存在，才让 Koishi 如此强大。

Koishi 是一个相当大的仓库，包含了各种各样的插件和适配器。目前整个项目由 Koishi 开发团队进行维护，核心模块由 [@shigma](https://github.com/shigma) 主导开发和设计。

请你在贡献之前阅读该指南的各个章节，以便了解如何向 Koishi 贡献，这不仅能节约双方的时间和精力，还可以让开发团队成员可以更好地追踪 Bug，跟踪 Issue，以及帮助你完成你的 Pull Request。
同时，我们希望你能遵循[贡献者公约](./CODE_OF_CONDUCT.md)中的各项要求，做到友好和善，一同创建良好的开源环境。

我们会邀请积极的贡献者加入我们的开发团队。

## 开始之前

- 如果你不知道应该从哪里开始入手，可以加入 [Discord](https://discord.gg/xfxYwmd284) 讨论。
- 如果你想要报告 Bug 或者提出新的功能，可以在 [GitHub](https://github.com/koishijs/koishi/issues/new/choose) 上提出一个 Issue。

## 可以贡献的范围（我可以贡献__吗？）

### 为已有的库添加新的特性

当然可以。不过在此之前建议你发一个 feature request 或者在官方群中与作者交流意见。这是为了确保你写的东西不会让别人的机器人挂掉。

### 贡献一个新的适配器 / 数据库实现

非常欢迎。不过目前 Koishi 的适配器和数据库的实现并不在官方仓库中，你或许应该去这里提交 Pull Request：

- 适配器：[satorijs/satori](https://github.com/satorijs/satori)
- 数据库：[shigma/minato](https://github.com/shigma/minato)

另外，适配器和数据库实现非常底层的东西，建议你在写之前熟悉一下 Koishi 的基本架构和文档。如果有什么疑问，也可以在 issues 或者官方群中提出。

### 贡献一个新的插件

Koishi 至今为止的官方插件数量已经非常非常多了，比起创建一个新的官方插件，我们更愿意见到社区插件丰富起来。
只要你为自己的插件添加上合适的前缀（如 `koishi-plugin-bar` 或 `@foo/koishi-plugin-bar`），Koishi 的插件市场便会自动收录。
对于活跃的社区贡献者，我们也会邀请其成为组织 @koishijs 的成员（现在已经有不少了）。

关于发布插件的指南，请参考[这篇文档](https://koishi.js.org/guide/plugin/publish.html)。

## 如何发送 Pull Request

### 基本流程

1. fork 这个仓库
2. 检出 master 分支
3. 在 HEAD 处创建一个自己的分支，比如 my-feature
4. 进行你的开发
5. 创建 pull request 到官方仓库的 master 分支

### 额外说明

1. 你交上来的所有文件应该是 ts 格式的并且能通过 yarn lint；如果你不熟悉 TypeScript，可以先发 draft PR 并在其中说明缘由
2. 如果是给已经有测试用例的库提交 PR，请确保单元测试依然通过；如果增加了新特性，请自行补充对应的单元测试
3. 如果你的更改涉及多个功能，请尽量分成多个 PR，这样可以更好的维护这些功能的兼容性
4. 我们将使用 squash 方式合并 PR，请保证你的标题符合下一节描述的格式。如果你的 PR 中包含多于一个 commit，尽量让每一个 commit message 都符合该格式

### 如何编写 Commit Message

1. 标题一定要是纯英文（可以包含适当的 emoji）
2. 要有一个合适的前缀，即你的 commit 标题应当满足下列格式：
    - fix(xxx): message
    - feat(xxx): message
    - test(xxx): message
    - build: message
    - chore: message
    - docs: message
3. 上面的 xxx 应该是下列词中的一个：core, cli, utils, test，以及官方适配器和插件的名字（例如 onebot, puppeteer 等）
4. merge commit 等自动产生的 commit message 不受限制

## 项目结构

你能在项目根目录看到 4 个目录：

- build: 包含构建相关脚本
- docker: 包含 Dockerfile
- packages: 包含 Koishi 核心库
- plugins: 包含官方插件库

## 官方仓库调试

如果你希望直接使用官方仓库调试机器人，可以尝试以下流程：

1. 运行 `yarn` 安装必要的依赖
2. 运行 `yarn scaffold` 创建一个模板项目
3. 现在，运行 `yarn dev` 即可启动你的机器人

你创建的模板项目将处于 `test` 目录下，这个目录已经被记录在了 .gitignore 中，所以你大可以放心地修改其中的内容。

## 脚本说明

### yarn build

执行全部的构建。

### yarn compile

执行 js 代码的编译。执行完成后虽然不会提供类型，但 koishi 就已经可以工作了。

### yarn dtsc

执行 dts 代码的编译。请不要使用 `tsc -b`。

### yarn test

运行单元测试。当你修改了某些内部行为时，请务必在本地看看测试有没有挂。

## Collaborator 开发指南

如果你收到了来自本仓库的神秘蓝色链接，点击它，你就成为了一名光荣的 Koishi Collaborator！你将可以：

- 在 issues 中有一个帅气的 collaborator 标识
- 直接推送到主仓库（你可以把之前的 fork 删掉啦）
- 审核其他人的 pull request

### 各分支功能
