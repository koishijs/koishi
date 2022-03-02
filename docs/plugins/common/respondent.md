---
sidebarDepth: 2
---

# 快捷回复 (Respondent)

@koishijs/plugin-respondent 允许设置一套内置问答，就像这样：

```js title="koishi.config.js"
module.exports = {
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

如果想要加入更高级和用户可定义的问答系统，可以参见 [@koishijs/plugin-teach](../teach.md)。
