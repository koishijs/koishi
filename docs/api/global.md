---
sidebarDepth: 2
---

# 其他内置 API

## 观察者对象

### observe(target, update?, label?)

- **target:** `T extends object` 要观测的对象
- **update:** `(diff: Partial<T>) => R` 更新回调函数
- **label:** `string` 对象的标签，用于标识
- 返回值: `Observed<T>`

创建一个观察者对象。目前只支持从普通对象创建（不支持 Array / Set / Map）。

### observed._diff

观察者当前的对象变化。

### observed._merge(source)

- **source:** `object` 要合并的对象
- 返回值: `this`

将某些属性合并入当前观察者，不会触发 diff 更新。

### observed._update()

- 返回值: `R`

更新观察者对象，同时清除 diff。

## 模板操作

### template(path, ...params)

- **path:** `string` 模板路径
- **params:** `any[]` 参数列表
- 返回值: `string` 生成的字符串

根据模板路径返回插值后的字符串。如果路径不存在将会返回路径本身。

### template.set(path, value)

- **path:** `string` 模板路径
- **value:** `string | object` 模板字符串
- 返回值: `void`

定义模板字符串。如果 `value` 是一个对象，则会将 `path` 作为前缀添加到每个路径中。

### template.get(path)

- **path:** `string` 模板路径
- 返回值: `string` 模板字符串

根据模板路径返回模板字符串。如果路径不存在将会返回路径本身。

### template.format(source, ...params)

- **source:** `string` 模板字符串
- **params:** `any[]` 参数列表
- 返回值: `string` 生成的字符串

使用模板语法插值。

## 输出日志

### new Logger(name)

### logger.level

### logger.extend()

### logger.error()

### logger.success()

### logger.warn()

### logger.info()

### logger.debug()

