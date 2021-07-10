---
sidebarDepth: 2
---

# 配置项

## prefix

- 类型: `string`
- 默认值: `'#'`

教学指令的前缀。

## authority

- 类型: `AuthorityConfig`
- 默认值: `{}`

教学系统各功能的权限设置。

```js
interface AuthorityConfig {
  base?: number     // 可访问教学系统，默认值为 2
  admin?: number    // 可修改非自己创建的问答，默认值为 3
  context?: number  // 可修改上下文设置，默认值为 3
  frozen?: number   // 可修改锁定的问答，默认值为 4
  regExp?: number   // 可使用正则表达式，默认值为 3
  writer?: number   // 可设置作者或匿名，默认值为 2
}
```

## historyAge

- 类型: `number`
- 默认值: `60000`

教学记录的保存时长，单位为毫秒。参见 [**查询近期操作**](./basic.md#查询近期操作)。

## nickname

- 类型: `string | string[]`
- 默认值: [`app.options.nickname`](../../api/app.md#options-nickname)

问答中使用的昵称。参见 [**称呼匹配**](./prob.md#称呼匹配)。

## appellationTimeout

- 类型: `number`
- 默认值: `60000`

[**称呼本身作为问题触发**](./prob.md#称呼本身作为问题触发) 的后续效果持续时间，单位为毫秒。

## maxRedirections

- 类型: `number`
- 默认值: `3`

[**问题重定向**](./interp.md#问题重定向) 的次数上限。

## previewDelay

- 类型: `number`
- 默认值: `500`

显示两个问答之间的时间间隔。

## maxPreviews

- 类型: `number`
- 默认值: `10`

同时查看的最大问答数量。

## itemsPerPage

- 类型: `number`

## mergeThreshold

- 类型: `number`

## maxAnswerLength

- 类型: `number`

## preventLoop

- 类型: `number | LoopConfig | LoopConfig[]`

控制防循环行为，参见 [**防刷屏机制**](./misc.md#防刷屏机制)。

```js
export interface LoopConfig {
  participants: number
  length: number
  debounce?: number
}
```

## throttle

- 类型: `ThrottleConfig | ThrottleConfig[]`

控制节流行为，参见 [**防刷屏机制**](./misc.md#防刷屏机制)。

```js
export interface ThrottleConfig {
  interval: number
  responses: number
}
```
