# 贡献指南

Koishi 是一个相当大的仓库，里面包含了各种各样的插件和适配器。作者在写完这一切以后才终于发现自己挖了一个不得了的大坑，并且并没有精力维护如此多的功能。因此，我们非常鼓励您亲自动手，参与到 Koishi 及其生态的开发中。同时，基于您对本仓库的贡献，我们也会在适当的时机邀请您成为本仓库的 collaborator。

## 在你贡献之前需要知道

### 我能给已有的库增加新特性吗？

当然可以。不过在此之前建议你发一个 feature request 或者在官方群中与作者交流意见。这是为了确保你写的东西不会让别人的机器人挂掉。

### 我能贡献一个新的平台/数据库实现吗？

非常欢迎。不过你需要知道平台和数据库实现非常底层的东西，建议你在写之前熟悉一下 Koishi 的基本架构和文档。如果有什么疑问，也可以在 issues 或者官方群中提出。

### 我能贡献一个新的插件吗？

Koishi 至今为止的官方插件数量已经非常非常多了，比起创建一个新的官方插件，作者更愿意见到社区插件丰富起来。你可以自己进行开发，然后列在[**这里**](https://github.com/koishijs/koishi#社区插件)。对于活跃的社区贡献者，我们也会邀请其成为 koishijs 的成员（现在已经有不少了）。

## 如何发送 Pull Request

### 基本流程

1. fork 这个仓库
2. 检出 develop 分支（注意不是 master）
3. 在 HEAD 处创建一个自己的分支，比如 my-feature
4. 进行你的开发
5. 创建 pull request 到 develop 分支

### 额外说明

1. 你交上来的所有文件应该是 ts 格式的并且能通过 yarn lint；如果你不熟悉 TypeScript，可以先发 draft PR 并在其中说明缘由
2. 如果是给已经有测试用例的库提交 PR，请确保单元测试依然通过；如果增加了新特性，请自行补充对应的单元测试
3. 我们不对 PR 中的 commit message 做硬性规定，但如果 PR 中所有的 commit message 均满足本仓库的要求，我会考虑使用 merge，其他情况下我都会使用 squash。这将影响你向本仓库贡献的 commit 数量。具体细节参见下一节

### 如何编写 Commit Message

1. 标题一定要是纯英文（当然可以包含适当的 emoji）
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
