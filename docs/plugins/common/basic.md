---
sidebarDepth: 2
---

# 基础指令

- 标有 <Badge text="群聊" vertical="baseline"/> 的功能只能在群聊环境触发
- 标有 <Badge text="数据库" vertical="baseline"/> 的功能需要你安装数据库支持

## 指令：echo

- 基本语法：`echo <message>`
- 最低权限：2
- 选项：
  - `-e, --escape` 发送转义消息（需要 3 级权限）
  - `-u, --user [@user]` 目标用户（需要 3 级权限）
  - `-c, --channel [#channel]` 目标频道（需要 3 级权限）

你可以使用 echo 指令发送消息到特定的上下文：

```sh
echo foo bar              # 向当前上下文发送 foo bar
echo -u @foo foo bar      # 向用户 foo 私聊发送 foo bar
echo -c #bar foo bar      # 向频道 bar 发送 foo bar
```

::: tip 提示
echo 指令的 message 参数是一个 [文本参数](../../guide/command.md#文本参数)，因此你应该把所有的选项写到消息前面，否则会被认为是消息的一部分。下面的几个指令也是如此。
:::

## 指令：broadcast <Badge text="数据库"/>

- 基本语法：`broadcast <message>`
- 最低权限：4
- 选项：
  - `-o, --only` 仅向当前账号负责的群进行广播
  - `-f, --forced` 无视 silent 标签进行广播

broadcast 指令用于按照 [代理者](../guide/manage.md#平台相关字段) 向所有机器人所负责的频道发送一段文本（默认情况下有 silent 标签的群不发送）。你可以这样调用它：

```sh
broadcast foo bar baz     # 向所有频道发送 foo bar baz
```

当一个机器人账号同时向多个频道发送广播消息时，为了避免风控，Koishi 会给每条消息发送后添加一段延迟，可以通过 [`delay.broadcast`](../../api/app.md#options-delay) 进行配置。

## 指令：contextify <Badge text="数据库"/>

- 别名：ctxf
- 基本语法：`contextify <command>`
- 最低权限：3
- 选项：
  - `-u, --user [@user]` 目标用户（私聊）
  - `-m, --member [@user]` 目标用户（群聊）
  - `-c, --channel [#channel]` 目标频道

与上面的两个指令相反，contextify 指令可以让你临时切换上下文调用指令。例如当你在私聊上下文时：

```sh
teach foo bar                       # 无效，因为 teach 指令只对群上下文生效
ctxf -g #456 teach foo bar          # 有效，相当于在群 456 调用 teach foo bar
```

除此以外，你还可以模拟其他上下文调用（假设你现在在群 123 中调用指令）：

```sh
ctxf -g #456 command                # 模拟你在群 456 的上下文
ctxf -u @789 command                # 模拟用户 789 的私聊上下文
ctxf -m @789 command                # 模拟用户 789 在当前频道的上下文
ctxf -u @789 -g #456 command        # 模拟用户 789 在频道 456 的上下文
```

尽管切换了调用上下文，但 contextify 指令的输出仍然产生在原上下文中。这在你想调用群指令的时候是很有用的。

::: tip 提示
为了安全性考虑，contextify 命令设计的最低使用权限为 3 级，同时切换的用户等级不能高于或等于调用者自身。
:::

## 指令：feedback

- 基本语法：`feedback <message>`

feedback 指令用于向开发者反馈信息。你需要首先配置 `operator` 配置项：

```js koishi.config.js
module.exports = {
  plugins: {
    common: {
      // 填你自己的账号，格式为 {platform}:{userId}
      // 也可以设置为一个数组，消息会被发送给每一个账户
      operator: 'onebot:123456789',
    },
  },
}
```

这样，当有人调用 feedback 指令时，传入的 message 就会自动被私聊发送给你。你也可以直接回复收到的反馈信息，机器人会把这些消息重新发回到调用 feedback 指令的上下文。这里的用法类似后面将介绍的 [跨频道消息转发](./handler.md#跨频道消息转发)。

<panel-view title="聊天记录 (私聊)">
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>收到来自 Alice 的反馈信息：</p>
<p>我也不知道该写什么总之这是一句话</p>
</chat-message>
<chat-message nickname="Operator" color="#f4a460">
<blockquote>
<p>收到来自 Alice 的反馈信息：</p>
<p>我也不知道该写什么总之这是一句话</p>
</blockquote>
<p>那么这是一句回复</p>
</chat-message>
</panel-view>

## 指令：recall <Badge text="群聊"/>

- 基本语法：`recall [count]`
- 最低权限：2

recall 指令用于撤回机器人在当前频道发送的最后几条消息。count 是要撤回的消息的数量，缺省时为 1。

与 broadcast 类似，为了避免风控，每撤回一条消息后 Koishi 也会等待一段时间，同样可以通过 [`delay.broadcast`](../../api/app.md#options-delay) 进行配置。
