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

### 使用插值

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

### 使用修饰符

## 渲染优先级

默认情况下的渲染优先级依次为：

- 频道语言 (`session.channel.locale`)
- 群组语言 (`session.guild.locale`)
- 默认语言 (`app.options.locale`)
- 无语言 (`''`)
- 其他任何语言

如果一种语言不存在对应的翻译，就会尝试使用下一种语言。如果所有语言均没有找到翻译，则会输出本身传入的渲染路径，同时输出一个警告。

### 语言回退

### 静默模式

如果在渲染路径的结尾加一个 `?` 字符，那么当找不到任何翻译时，机器人只会返回空串，同时也不会输出警告。

## 指令本地化

### 作用域渲染

## 编写翻译文件

### 工作区开发

### 覆盖默认文本
