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
session.text('apples', [])              // no apples
session.text('apples', [new Apple()])   // one apple
session.text('apples', { length: 2 })   // 2 apples
```

## 随机渲染

`@random` 预设会在运行时随机选择一个结果：

```yaml
not-found@random:
  - 魔理沙偷走了重要的东西。
  - 此条目纯属虚构，包含的内容已遁入幻想。
  - 没有相关结果。您要找的是不是：蕾米莉亚的威严？
```
