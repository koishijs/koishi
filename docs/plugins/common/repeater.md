---
sidebarDepth: 2
---

# 复读机 (Repeater)

复读功能一直是很多机器人的传统艺能，但是 Koishi 敢说自己能做得更多。利用内置的复读插件，你的机器人不仅可以实现概率复读，还可以概率打断，甚至可以检测他人重复复读或打断复读的行为并做出回应。让我们开始吧！

## 控制复读时机和概率

通过提供 `onRepeat` 参数，我们可以定义机器人在检测到复读时进行怎样的行为，是跟着复读，还是进行打断，甚至是出警。首先让我们看一个最简单的例子：

```yaml title=koishi.yml
plugins:
  repeater:
    onRepeat:
      minTimes: 3
      probability: 0.5
```

<panel-view :messages="[
  ['Alice', 'foo'],
  ['Bob', 'foo'],
  ['Carol', 'foo'],
  ['Koishi', 'foo'],
  ['Dave', 'foo'],
]"/>

在这种配置下，当复读语句达到 3 句后，每一次其他人的复读都有 50% 的概率触发机器人的复读行为。而一旦复读后，机器人将不再重复复读。

`onRepeat` 除了可以接受一个对象作为参数以外，也支持接受一个函数来自定义当机器人检测到复读时执行的具体行为。下面我们来举几个例子。

## 自动打断复读

`onRepeat` 函数可以接受两个参数。第一个参数为当前复读行为的状态 state，其中包含目前复读次数 times, 复读语句内容 content，参与复读的用户与他们的复读次数 users，机器人是否已经复读 repeated；第二个参数是当前的会话 session。

当我们也不希望机器人复读所有的内容，我们可以通过如下配置让机器人自动打断某些复读：

```ts title=koishi.ts
export default {
  plugins: {
    repeater: {
      onRepeat: (state) =>
        state.times >= 2 &&
        state.content === "这机器人又开始复读了" &&
        "打断复读！",
    }
  }
}
```

<panel-view :messages="[
  ['Alice', '这机器人又开始复读了'],
  ['Bob', '这机器人又开始复读了'],
  ['Koishi', '打断复读！'],
]"/>

## 检测重复复读

来看一个更复杂的例子。我们还可以让 Koishi 对所有将同一句话复读 2 次的用户作出警告。你可以这样配置：

```ts title=koishi.ts
export default {
  plugins: {
    repeater: {
      onRepeat: (state, session) =>
        state.users[session.userId] > 1 &&
        segment.at(session.userId) + "不许重复复读！"
    },
  },
}
```

<panel-view :messages="[
  ['Alice', 'foo'],
  ['Bob', 'foo'],
  ['Alice', 'foo'],
  ['Koishi', '不许重复复读！'],
]"/>

## 检测打断复读

复读机插件支持的另一个参数 `onInterrupt` 可以定义机器人在检测到复读被其他人打断时的行为。可以传入一个函数来定义此行为，函数签名与 `onRepeat` 一致。

例如，如果你想让你的机器人在一条信息已经复读过 5 次以上，且自己也已经复读过后，对任何打断复读的人以 50% 的概率出警。你可以这样配置：

```ts title=koishi.ts
export default {
  plugins: {
    repeater: {
      onRepeat:{
        minTimes: 2
      },
      onInterrupt: (state, session) =>
        state.repeated &&
        state.times >= 3 &&
        Math.random() > 0.5 &&
        segment.at(session.userId) + "在？为什么打断复读？",
    },
  },
}
```

<panel-view :messages="[
  ['Alice', 'bar'],
  ['Bob', 'bar'],
  ['Koishi', ' bar'],
  ['Dave', '打断复读'],
  ['Koishi', ' 在？为什么打断复读？'],
]"/>

## 完整的配置项参考

```ts
interface RepeatState {
  content: string
  repeated: boolean
  times: number
  users: Record<number, number>
}

type StateCallback = (state: RepeatState, session: Session) => void | string

interface RepeatHandler {
  minTimes: number
  probability?: number
}

interface RepeaterOptions {
  onRepeat?: RepeatHandler | StateCallback
  onInterrupt?: StateCallback
}
```
