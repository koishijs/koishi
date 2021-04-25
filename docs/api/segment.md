---
sidebarDepth: 2
---

# 消息段 (Segment)

**消息段** 的概念最早起源于 CoolQ，用于在纯文本中表达特殊的消息语义。由于这种方式非常便捷，也被 Koishi 所沿用至今。

消息段协议本身也是 OneBot 协议的 [一部分](https://github.com/howmanybots/onebot/blob/master/v11/specs/message/segment.md)，但该协议与 Koishi 所使用的消息段**存在一定的区别，在实际使用时请以本页文档为准**。由于 koishi-adapter-onebot 会自动进行两种协议间的转换，你并不需要担心兼容性问题。

## 消息段操作

一个消息段对象的结构如下：

```js
interface segment {
  type: string
  data: Record<string, string | number | boolean>
}
```

### segment(type, data)

- **type:** `string` 消息段类型
- **data:** `object` 消息段参数
- 返回值: `string` 生成的消息段

将一个对象转化成消息段文本。

### segment.join(codes)

- **codes:** `segment[]` 消息段数组
- 返回值: `string` 生成的文本

将多个 segment 对象转化成文本并连接。

### segment.escape(source, inline?)

- **source:** `string` 源文本
- **inline:** `boolean` 在消息段内部转义（会额外处理逗号）
- 返回值: `string` 转义过后的文本

转义一段文本到消息段格式。

### segment.unescape(souce)

- **source:** `string` 源文本
- 返回值: `string` 转义前的文本

取消一段文本的消息段转义。

### segment.from(source)

- **source:** `string` 源文本
- 返回值: `segment` 消息段的类型和参数

将一个消息段文本解析成对象。

### segment.parse(source)

- **source:** `string` 源文本
- 返回值: `segment[]` 消息段数组

解析一段文本内的全部消息段。其中的纯文本将会解析成 text 类型。

## 元素消息段

元素消息段是一段拥有特定语义的文本，通常可以出现在一段消息中的任何位置。发送时只需提供 `id`。当存在不受支持的消息段时，适配器应该用 `name` 或 `id` 代替。

### 纯文本 (text)

- **content:** `string` 文本内容

这是一个特殊的消息段。使用 `segment('text', { content })` 将等价于 `content` 本身。此消息段仅出现于 `segment.parse()` 方法的返回值中。

### 指定用户 (at)

- **id:** `string` 目标用户的 ID
- **name:** `string` 目标用户的名称
- **role:** `string` 目标角色
- **type:** `string` 特殊操作，例如 all 表示 @全体成员，here 表示 @在线成员

由于上述几个属性的语义是互斥的，发送时使用 `id`, `role`, `type` 其一即可。

### 指定频道 (sharp)

- **id:** `string` 目标频道的 ID
- **name:** `string` 目标频道的名称

### 表情 (face)

- **id:** `string` 表情的 ID
- **name:** `string` 表情的名称

## 资源消息段

资源消息段表示文本中存在的资源文件。不同的平台对资源文件的支持存在较大的差异。发送时只需提供 `url`。如果某个平台不支持特定的资源类型，适配器应该用 `url` 代替。如果某个平台不支持将资源消息段和其他消息段同时发送，适配器应该分多条发送，并返回最后一条消息的 ID。

- **file:** `string` 资源在本地目录的相对路径
- **url:** `string` 资源的 URL（可以是网络 URL，文件绝对路径，或 base64 协议等）
- **cache:** `boolean` 是否使用已缓存的文件
- **timeout:** `string` 下载文件的最长时间

### 图片 (image)

除了上述通用属性外，还支持下面的属性：

- **type:** 特殊类型，例如 flash 表示 QQ 闪照

### 语音 (audio)

参见上述通用属性。

### 视频 (video)

参见上述通用属性。

### 文件 (file)

参见上述通用属性。

## 前缀消息段

前缀消息段只会出现在一段消息的第一个，用于表示这段消息的发送方式。由于其本身不包含任何信息，发送前应从消息中清除。

### 引用 (quote)

- **id:** `string` 要引用的消息 ID

### 卡片 (card)

### 匿名 (anonymous)

- **ignore:** `boolean` 当无法发送匿名消息时，如果此项为 `true`，则直接删去此前缀码；否则将不产生任何输出

### Markdown (markdown)
