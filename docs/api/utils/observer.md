---
sidebarDepth: 2
---

# 观察者 (Observer)

## observe(target, update?, label?)

- **target:** `T extends object` 要观测的对象
- **update:** `(diff: Partial<T>) => R` 更新回调函数
- **label:** `string` 对象的标签，用于标识
- 返回值: `Observed<T>`

创建一个观察者对象。目前只支持从普通对象创建（不支持 Array / Set / Map）。

## observed.$diff

观察者当前的对象变化。

## observed.$merge(source)

- **source:** `object` 要合并的对象
- 返回值: `this`

将某些属性合并入当前观察者，不会触发 diff 更新。

## observed.$update()

- 返回值: `R`

更新观察者对象，同时清除 diff。
