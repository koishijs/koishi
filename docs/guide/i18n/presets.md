---
sidebarDepth: 2
---

# 使用预设模板

## 处理单复数

在实际应用中，我们可能要根据某个数值改变输出的结果。让我们看一个简单的例子：

```yaml
apple@plural:
  - You have no apples
  - You have one apple
  - You have {length} apples
```

如你所见，我们使用 `@plural` 为 apple 指定了一个预设模板。这个预设模板会在运行时按照其特有的逻辑来渲染：

```ts
class Apple {}
// ---cut---
session.text('apples', [])              // You have no apples
session.text('apples', [new Apple()])   // You have one apple
session.text('apples', { length: 2 })   // You have 2 apples
```

## 列表渲染

`@list` 预设模板可以用来渲染列表或对象：

```yaml
rank@list:
  header: 当前排名如下：
  item: '第 {key} 名：{value}'
  footer: 要查看特定结果，请使用 --all 选项。
```

```ts
session.text('rank', ['foo', 'bar'])
```

<panel-view title="聊天记录">
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>当前排名如下：</p>
<p>第 1 名：foo</p>
<p>第 2 名：bar</p>
<p>要查看更多结果，请使用 --all 选项。</p>
</chat-message>
</panel-view>

## 随机渲染

`@random` 预设会在运行时随机选择一个结果：

```yaml
not-found@random:
  - 魔理沙偷走了重要的东西。
  - 此条目纯属虚构，包含的内容已遁入幻想。
  - 没有相关结果。您要找的是不是：蕾米莉亚的威严？
```
