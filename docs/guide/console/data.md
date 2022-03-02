---
sidebarDepth: 2
---

# 数据交互

前后端的数据交互基本是通过 WebSocket 实现的。为了适应不同的场景，我们提供了多种数据交互的形式。

## 被动推送

后端代码：

```ts title="src/index.ts"
// @koishiDocsNoHeader
import { Context } from 'koishi'
import { DataService } from '@koishijs/plugin-console'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      custom: CustomProvider
    }
  }
}

class CustomProvider extends DataSource<string[]> {
  constructor(ctx: Context) {
    super(ctx, 'custom')
  }

  get() {
    return ['Hello', 'World']
  }
}

export const name = 'my-plugin'
export const using = ['console'] as const

export function apply(ctx: Context) {
  ctx.plugin(CustomProvider)

  ctx.console.addEntry({
    dev: resolve(__dirname, 'client/index.ts'),
    prod: resolve(__dirname, 'dist'),
  })
}
```

前端代码：

```ts title="client/index.ts"
// @koishiDocsNoHeader
import { Context } from '@koishijs/client'
import Page from './custom-page.vue'

export default (ctx: Context) => {
  ctx.addPage({
    name: '页面标题',
    path: '/custom-page',
    // 只有当获得了 custom 数据，才可以访问页面
    fields: ['custom'],
    component: Page,
  })
}
```

```vue client/custom-page.vue
<template>
  <!-- 这里应该有类型支持，并且支持数据响应式变化 -->
  <k-card>{{ store.custom }}</k-card>
</template>

<script>
import { store } from '@koishijs/client'
</script>
```

## 主动获取

后端代码：

```ts title="src/index.ts"
// @koishiDocsNoHeader
import { Context } from 'koishi'
import { DataService } from '@koishijs/plugin-console'

declare module '@koishijs/plugin-console' {
  interface Events {
    'get-greeting'(): string[]
  }
}

export const name = 'my-plugin'
export const using = ['console'] as const

export function apply(ctx: Context) {
  ctx.console.addListener('get-greeting', () => {
    return ['Hello', 'World']
  })

  ctx.console.addEntry({
    dev: resolve(__dirname, 'client/index.ts'),
    prod: resolve(__dirname, 'dist'),
  })
}
```

```vue title="client/custom-page.vue"
<template>
  <k-card>{{ greeting }}</k-card>
</template>

<script>
import { send } from '@koishijs/client'
import { ref } from 'vue'

const greeting = ref<string[]>()

send('get-greeting').then(data => {
  greeting.value = data
})
</script>
```

## 权限管理

当你引入了 @koishijs/plugin-auth 插件之后，你可以为你的页面访问和数据交互引入鉴权机制：

```ts
// 只有已登录并且权限等级不低于 3 的用户才能访问此接口
ctx.console.addListener('get-greeting', () => {
  return ['Hello', 'World']
}, { authority: 3 })
```

```ts title="client/index.ts"
ctx.addPage({
  name: '页面标题',
  path: '/custom-page',
  // 只有已登录并且权限等级不低于 3 的用户才能访问此界面
  authority: 3,
  component: Page,
})
```
