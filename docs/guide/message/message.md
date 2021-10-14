---
sidebarDepth: 2
---

# 处理消息文本

## 使用消息段

当然，一个聊天平台所能发送或接收的内容往往不只有纯文本——请放心，无论是 @其他人、发送表情、上传文件还是更加复杂的卡片消息都是 Koishi 所能处理的范围。

`segment()` 函数传入两个参数，第一个参数是消息段的类型，第二个参数是一个对象，表示这个消息段的属性。如果希望在你的消息中 @某某用户，或发送一张图片，你可以使用下面的写法：

```js
// @某某用户 我在叫你哟！
session.send(segment('at', { id: userId }) + '我在叫你哟！')

// 你发送了一张 Koishi 图标
session.send(segment('image', { url: 'https://koishi.js.org/koishi.png' }))
```

**前缀消息段**表达了你发送的消息具有某些特殊语义。当你要发送匿名消息，或者引用其他消息的内容，你同样只需要在消息的开头加上一个消息段即可：

```js
session.send(segment('anonymous') + '这是一条匿名消息。')

session.send(segment('quote', { id: messageId }) + '这是一条回复消息。')
```

为了方便起见，在实际应用时，你可以使用 `s()` 代替 `segment()`。

## 使用模板

Koishi 自身就提供了丰富的生态，但如果你觉得某些功能输出的内容缺乏个性化，有没有办法修改它们的行为呢？这时候就可以使用**模板**来解决。

使用 `template.set()` 定义一个模板，并使用 `template()` 获取一个模板的值：

```js
template.set('foo', 'foo{0}ooo')

template('foo', 'bar') // 'foobarooo'
```

又因为官方的多数输出行为都可以使用模板控制，你便可以通过 `template.set()` 覆盖这些行为了。下面举一个例子（假设 echo 是一条有时间间隔限制的指令）：

```js
template.set('internal.too-frequent', '调用太频繁了亲~')
```

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">echo foo</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">foo</chat-message>
<chat-message nickname="Alice" color="#cc0066">echo foo</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">调用太频繁了亲~</chat-message>
</panel-view>

为了方便起见，在实际应用时，你可以使用 `t()` 代替 `template()`。
