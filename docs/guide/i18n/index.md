---
sidebarDepth: 2
---

# 多语言支持

::: warning
多语言支持目前属于实验性功能。
:::

如果你在运营一个大型社区，那么你可能会遇到这种场景：群组内设立了许多不同语言的频道，每个频道分别供不同地区的用户进行交流。在这种情况下，最合适的做法是让你的机器人在不同的频道下使用不同的语言进行回复。本质上，这不会改变机器人的运行逻辑，因此最好的做法是将涉及的每一段文本都抽离出来，通过统一的方式进行管理，并在发送前进行本地化渲染。

## 基本用法

让我们先看一个最简单的例子：

```ts
ctx.i18n.define('zh', { hello: '你好！' })
ctx.i18n.define('en', { hello: 'Hello!' })
```

上面的代码描述了两个语言包，分别包含中文和英文下 `hello` 对应的翻译文本。其中 `zh` 和 `en` 称为语言名，`hello` 称为渲染路径，后面的字符串是对应的翻译文本。

现在我们把它用在指令中：

```ts
ctx.command('greeting').action(({ session }) => {
  return session.text('hello')
})
```

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">greeting</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">你好！</chat-message>
</panel-view>

我们看到机器人回复了「你好！」，这是因为 Koishi 使用的默认语言是中文。

现在，如果我们希望它在某个频道使用英文，我们只需设置这个频道的属性：

```ts
channel.locale = 'en'
```

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">greeting</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">Hello!</chat-message>
</panel-view>

### 插值语法

向 `session.text()` 中传入第二个参数，就可以在模板中使用单花括号插值。花括号中的内容将对应传入列表的索引。

```ts
ctx.i18n.define('zh', { hello: '你好，{0}！' })
ctx.i18n.define('en', { hello: 'Hello, {0}!' })

ctx.command('greeting').action(({ session }) => {
  return session.text('hello', [session.author.username])
})
```

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">greeting</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">Hello, Alice!</chat-message>
</panel-view>

这里的参数也可以是一个对象，此时花括号中的内容仍然表示对象的索引。

```ts
ctx.i18n.define('zh', { hello: '你好，{username}！' })
ctx.i18n.define('en', { hello: 'Hello, {username}!' })

ctx.command('greeting').action(({ session }) => {
  return session.text('hello', session.author)
})
```

如果要访问对象深层的内容，只需将多个属性之间用 `.` 连接。利用这种方法，你甚至可以把整个 `session` 传进去：

```ts
ctx.i18n.define('zh', { hello: '你好，{author.username}！' })
ctx.i18n.define('en', { hello: 'Hello, {author.username}!' })

ctx.command('greeting').action(({ session }) => {
  return session.text('hello', session)
})
```

上述三段代码的实际效果完全相同，可以根据自己的需要进行选择。

## 渲染回退

### 语言优先级

默认情况下的渲染优先级依次为：

- 频道语言 (`session.channel.locale`)
- 群组语言 (`session.guild.locale`)
- 用户语言 (`session.user.locale`)
- 默认语言 (`app.options.locale`)
- 无语言 (`''`)
- 其他任何语言

如果一种语言不存在对应的翻译，就会尝试使用下一种语言。如果所有语言均没有找到翻译，则会输出本身传入的渲染路径，同时输出一个警告。

### 路径回退

你也可以配置多个路径，将会按照顺序查找翻译，直到找到一个翻译为止。

```ts
session.text(['foo', 'bar'])
```

路径回退的优先级低于语言回退。举个例子，假如可选的语言包括 A 和 B，路径包括 1 和 2。翻译 A1 不存在，但是翻译 A2 和 B1 都存在。这种情况下会输出 B1 而非 A2。

::: tip
采用这种设计是因为不同的路径通常表达了不同的逻辑。相比语言的正确性，逻辑的正确性更重要。
:::

利用这种行为，你可以实现静默渲染。下面的代码当未找到翻译时，将只会输出一个空串，并且不会输出警告：

```ts
session.text(['foo', ''])
```

## 指令本地化

在 [编写帮助](../command/help.md#编写帮助) 一节中，我们已经了解到指令和参数的描述文本都是在指令注册时就定义的。这种做法对单语言开发固然方便，但并不适合多语言开发，因为它将翻译逻辑与代码逻辑耦合了。如果你希望你编写的指令支持多语言，那么需要将翻译文本单独定义：

```ts
ctx.i18n.define(zh, {
  commands: {
    foo: {
      description: '指令描述',
      options: {
        bar: '选项描述',
      },
    },
  },
})

ctx.command('foo').options('bar')
```

### 作用域渲染

## 编写翻译文件

### 工作区开发

### 覆盖默认文本
