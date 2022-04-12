---
sidebarDepth: 2
---

# 快捷回复 (Respondent)

@koishijs/plugin-respondent 允许设置一套内置问答，就像这样：

```ts title=koishi.ts
export default {
  plugins: {
    respondent: [{
      match: 'awsl',
      reply: '爱我苏联',
    }, {
      match: /^\s*(\S +){2,}\S\s*$/,
      reply: '空格警察，出动！',
    }, {
      match: /^(.+)一时爽$/,
      reply: (_, str) => `一直${str}一直爽`,
    }],
  },
}
```

<panel-view :messages="[
  ['Alice', 'awsl'],
  ['Koishi', '爱我苏联'],
  ['Bob', '久 等 了'],
  ['Koishi', '空格警察，出动！'],
  ['Carol', '挖坑一时爽'],
  ['Koishi', '一直挖坑一直爽'],
]"/>

其中 `match` 可以是一个字符串或正则表达式，用来表示要匹配的内容；`reply` 可以是一个字符串或传入字符串的函数，用来表示输出的结果。`respondent` 数组会按照从上到下的顺序进行匹配。

::: tip 提示
`reply` 的函数定义如下：

```ts
(...capture: string[]) => string
```

当 `match` 是字符串时，`capture` 数组仅包含匹配的字符串这一个参数，即 `[message]`；

当 `match` 是正则表达式时，`capture` 数组是 `String.prototype.match(match)` 的返回结果，即 `[message, ...captureGroups]` (第一个参数是接收到的信息本身，其他为正则表达式所匹配的捕获组)。
:::

如果想要加入更高级和用户可定义的问答系统，可以参见 [@koishijs/plugin-teach](../teach/index.md)。
