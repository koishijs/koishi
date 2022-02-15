---
sidebarDepth: 2
---

# 编写扩展

## 创建扩展

::: code-group manager
```npm
npm i @koishijs/client @koishijs/plugin-console -D
```
```yarn
yarn add @koishijs/client @koishijs/plugin-console -D
```
:::

在项目中新建这几个文件：

```diff
└── my-plugin
+   ├── client
+   │   ├── index.ts
+   │   ├── custom-page.vue
+   │   └── tsconfig.json
    ├── src
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

```ts client/index.ts
import { Context } from '@koishijs/client'
import Page from './custom-page.vue'

export default (ctx: Context) => {
  // 此 Context 非彼 Context
  // 我们只是在前端同样实现了一套插件逻辑
  ctx.addPage({
    name: '页面标题',
    path: '/custom-page',
    component: Page,
  })
}
```

```vue client/custom-page.vue
<template>
  <k-card>扩展内容</k-card>
</template>
```

```json client/tsconfig.json
{
  "compilerOptions": {
    "rootDir": ".",
    "module": "esnext",
    "moduleResolution": "node",
    "types": [
      // 这一行的作用是导入相关全局类型
      // 以便于在编辑器中显示更好的代码提示
      "@koishijs/client/global",
    ],
  },
  "include": ["."],
}
```

接着修改你的入口文件：

```ts src/index.ts
import { resolve } from 'path'

export const name = 'my-plugin'

export function apply(ctx: Context) {
  // 在已有插件逻辑的基础上，添加下面这段
  ctx.using(['console'], (ctx) => {
    ctx.console.addEntry({
      dev: resolve(__dirname, 'client/index.ts'),
      prod: resolve(__dirname, 'dist'),
    })
  })
}
```

## 调试模式

启动应用，并配置 console 插件进入调试模式：

```yaml
plugins:
  console:
    devMode: true
  my-plugin:
```

你就可以在网页中看到自己刚刚创建的页面了。

## 构建代码

调试好你的扩展后，下一步就是构建了。修改你的 package.json：

```json package.json
{
  "files": [
    "lib",    // 我们假设 src 目录编译到 lib 目录
    "dist",   // 这里的 dist 目录就是留给 client 的
  ],
  "scripts": {
    // @koishijs/client 提供了一个指令 koishi-console build
    // 它可以用来构建 client 目录中的扩展台扩展到 dist 目录
    "build:console": "koishi-console build",
  },
}
```

然后运行上面的脚本就大功告成啦：

::: code-group manager
```npm
npm run build:console
```
```yarn
yarn build:console
```
:::
