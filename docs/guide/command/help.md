---
sidebarDepth: 2
---

# 查看和编写帮助

::: tip
下面的 echo 指令是为了理解方便而举的例子，与 @koishijs/plugin-echo 中实际的 echo 指令并不相同。
:::

## 查看帮助

Koishi 拥有着强大的指令系统，然而过于复杂的功能也会困扰使用者。因此，Koishi 也内置了 help 指令，用于输出全部或特定指令的使用方法。你可以使用 `help` 查看指令列表：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">help</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>当前可用的指令有：</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;echo  输出收到的信息</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;help  显示帮助信息</p>
<p>输入“帮助+指令名”查看特定指令的语法和使用示例。</p>
</chat-message>
</panel-view>

或通过 `help echo` 或 `echo -h` 查看特定指令的信息，包括指令的名称，参数，选项，子指令，权限设置等等。这里的 echo 是指令名，但也可以换成 [指令别名](./execute.md#指令别名) 甚至 [快捷方式](./execute.md#快捷方式)。具体的细节将在下面的介绍。

## 编写帮助

之前已经介绍了 `ctx.command()` 和 `cmd.option()` 这两个方法，它们都能传入一个 `desc` 参数。你可以在这个参数的结尾补上对于指令或参数的说明文字，就像这样：

```ts
ctx.command('echo <message:text> 输出收到的信息')
  .option('timeout', '-t <seconds> 设定延迟发送的时间')
```

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">echo -h</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>echo &lt;message></p>
<p>输出收到的信息</p>
<p>可用的选项有：</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;-t, --timeout &lt;seconds>  设定延迟发送的时间</p>
</chat-message>
</panel-view>

### 添加用法和使用示例

当然，我们还可以加入具体的用法和使用示例，进一步丰富这则使用说明：

```ts
ctx.command('echo <message:text>', '输出收到的信息')
  .option('timeout', '-t <seconds> 设定延迟发送的时间')
  .usage('注意：参数请写在最前面，不然会被当成 message 的一部分！')
  .example('echo -t 300 Hello World  五分钟后发送 Hello World')
```

这时再调用 `echo -h`，你便会发现使用说明中已经添加了你刚刚的补充文本：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">echo -h</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>echo &lt;message></p>
<p>输出收到的信息</p>
<p>注意：参数请写在最前面，不然会被当成 message 的一部分！</p>
<p>可用的选项有：</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;-t, --timeout &lt;seconds>  设定延迟发送的时间</p>
<p>使用示例：</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;echo -t 300 Hello World  五分钟后发送 Hello World</p>
</chat-message>
</panel-view>

最后，如果直接调用 `help`，输出的会是全部指令组成的列表。

### 隐藏指令和选项

读到这里，细心的你可能会产生一丝好奇：如果 `echo -h` 能够被解析成查看帮助的话，这个 `-h` 为什么不出现在这个帮助中呢？答案很简单，因为这个内置选项被 Koishi 隐藏起来了。如果你希望隐藏一条指令或一条指令，只需要注册时将配置项 `hidden` 设置为 `true` 即可：

```ts
ctx.command('bar 一条看不见的指令', { hidden: true })
  .option('foo', '<text> 一个看不见的选项')
  .action(({ options }) => 'secret: ' + options.foo)
```

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">help</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>当前可用的指令有：</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;help  显示帮助信息</p>
<p>输入“帮助+指令名”查看特定指令的语法和使用示例。</p>
</chat-message>
<chat-message nickname="Alice" color="#cc0066">bar --foo 123</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">secret: 123</chat-message>
</panel-view>

如果要查看隐藏的指令和选项，可以使用 `help -H`：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">help -H</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>当前可用的指令有：</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;help  显示帮助信息</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;bar  一条看不见的指令</p>
<p>输入“帮助+指令名”查看特定指令的语法和使用示例。</p>
</chat-message>
</panel-view>

## 指令的多级结构

尽管指令的注册非常方便，但是当指令数量变多时，另一些问题也会随之浮现出来：大量的指令不便于列表显示（想象一下你的机器人输出由上百条指令构成的列表的时候会是何等的刷屏），同时来自不同插件的指令可能存在名称冲突。本节所介绍的 **多级指令**，便是对这一类问题的解决方案。

### 子指令

通过 `cmd.subcommand()` 方法可以创建子指令，它的调用方法与 `ctx.command()` 是完全一致的，唯一的区别是创建的指令将被标记为原来指令的子指令。下面我们举个简单的例子，假设你运行了下面的代码：

```ts
ctx.command('foo').subcommand('bar')
```

则此时调用 `help` 所获得的指令列表中将不会显示 bar，但是会标注 foo 含有子指令。如果再调用 `help foo`，则可以看到其子指令列表中含有指令 bar。而与此同时，你仍然可以直接调用 bar 指令或通过调用 `help bar` 查看其帮助。这样一来，你便可以对你的大量指令进行分组管理，从而有效降低列表的长度。这就成功解决了上面提出的第一个问题。

在解决第二个问题之前，先让我介绍一下 Koishi 支持的两种子指令格式。一种是 **层级式**，也就是刚刚演示的这种；而另一种则叫 **派生式**。后者跟前者的区别是，它在调用时要额外加个前置小数点：

```ts
ctx.command('foo').subcommand('.bar')
ctx.command('foo').subcommand('foo.bar') // 这两种写法是等价的
```

此时将不会有 bar 这条指令，取而代之的是 foo.bar。调用 `help` 所获得的指令列表中将不会显示 foo.bar，但是同样会标注 foo 含有子指令。如果再调用 `help foo`，则可以看到其子指令列表中含有指令 foo.bar。与此同时，无论是直接调用 bar 指令还是调用 `help bar` 都是无效的，你必须显式地写出全名才行。这样一来，你就可以成功区分重名指令，从而解决上面提出的第二个问题。

尽管有一些不同，但是上述两种指令都属于 foo 的子指令，因此它们：

- 都不会显示在 `help` 的输出中（因为它们都不是一级指令）
- 都会显示在 `help foo` 的输出中（因为它们都是 foo 的子指令）

### 链式注册

如果你想创建一个 foo 指令，其含有一个 bar 作为子指令，用上面的写法的确是一种很好的做法。但是如果 foo 是已经存在的指令，这种写法还生效吗？这一点上，你并不需要担心。Koishi 内部的逻辑可以保证：当调用 `ctx.command()` 方法时，如果指令不存在将会被创建；而如果指令已存在（并且在当前上下文内），除去其他参数可以对其进行修改外，将会直接返回之前注册的指令本身。因此，你可以使用下面的写法来创建两种子指令：

```ts
ctx.command('foo').subcommand('bar')
ctx.command('foo').subcommand('.baz')
```

Koishi 为其提供了一种更加简便的等价写法，称为 **链式注册**：

```ts
ctx.command('foo/bar') // 用斜杠表示层级式子指令
ctx.command('foo.bar') // 用小数点表示派生式子指令
```

利用这种写法，你甚至可以快速注册多级指令：

```ts
ctx.command('foo.bar/abc.xyz')
```

## 禁用帮助功能

如果你在开发用于特定目的的机器人，你可能不希望用户使用全局的 help 指令查看指令列表。

```yaml koishi.yml
# 禁用帮助指令
help: false

# 配置帮助指令
help:
  # 不能通过 -h 触发帮助指令
  options: false
  # 禁用全局「帮助」快捷调用（指令依然存在）
  shortcut: false
```
