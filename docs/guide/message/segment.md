---
sidebarDepth: 2
---

# 使用消息段

当然，一个聊天平台所能发送或接收的内容往往不只有纯文本——请放心，无论是 @其他人、发送表情、上传文件还是更加复杂的卡片消息都是 Koishi 所能处理的范围。

`segment()` 函数传入两个参数，第一个参数是消息段的类型，第二个参数是一个对象，表示这个消息段的属性。如果希望在你的消息中 @某某用户，或发送一张图片，你可以使用下面的写法：

```ts
declare const userId: string

// ---cut---
// @某某用户 我在叫你哟！
session.send(segment('at', { id: userId }) + '我在叫你哟！')

// 你发送了一张 Koishi 图标
session.send(segment('image', { url: 'https://koishi.js.org/koishi.png' }))
```

**前缀消息段**表达了你发送的消息具有某些特殊语义。当你要发送匿名消息，或者引用其他消息的内容，你同样只需要在消息的开头加上一个消息段即可：

```ts
declare const messageId: string

// ---cut---
session.send(segment('anonymous') + '这是一条匿名消息。')

session.send(segment('quote', { id: messageId }) + '这是一条回复消息。')
```

为了方便起见，在实际应用时，你可以使用 `s()` 代替 `segment()`。
