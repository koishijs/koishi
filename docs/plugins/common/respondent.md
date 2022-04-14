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

如果想要加入更高级和用户可定义的问答系统，可以参见 [@koishijs/plugin-teach](../teach/index.md)。

## 配置项

### rules

- 类型: `Array`

`respondent` 的规则数组，按照从上到下的顺序进行匹配。

### rules[].match

- 类型: `string | RegExp`

要匹配的内容。

### rules[].reply

- 类型: `string | ((...capture: string[]) => string)`

输出的结果。

`reply` 函数的传入参数与 [`String.prototype.replace`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/replace#%E5%8F%82%E6%95%B0) 类似：

当 `match` 是字符串时，`capture` 数组仅包含匹配的字符串这一个参数，即 `[message]`；

当 `match` 是正则表达式时，`capture` 数组包含了源信息和正则表达式所匹配的捕获组，即 `[message, ...captureGroups]`。
