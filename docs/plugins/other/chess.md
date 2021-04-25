---
sidebarDepth: 2
---

# 棋类游戏 (Chess)

::: tip
本插件在有数据库的情况下会自动保存棋局状态，即使机器人重新启动也能自动恢复。要启用自动保存功能，你需要安装数据库支持。
:::

::: tip
本插件同时支持以文本和图片两种形式显示棋局。要启用图片功能，你需要安装 [koishi-plugin-puppeteer](./puppeteer.md)。
:::

koishi-plugin-chess 提供了下棋功能。目前支持的规则有：

- 五子棋
- 围棋（禁全同，暂时不支持点目）
- 黑白棋

下面是一个简单的示例：

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">黑白棋</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png" class="no-padding">
<img src="/chess/othello-1.svg" width="240"/>
</chat-message>
<chat-message nickname="Bob" color="#00994d">落子 E6</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">Bob 加入了游戏并落子于 E6，下一手轮到 <strong>@Alice</strong>。</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png" class="no-padding">
<img src="/chess/othello-2.svg" width="240"/>
</chat-message>
<chat-message nickname="Alice" color="#cc0066">落子 F6</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">Alice 落子于 E6，下一手轮到 <strong>@Bob</strong>。</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png" class="no-padding">
<img src="/chess/othello-3.svg" width="240"/>
</chat-message>
</panel-view>

## 开始和停止棋局

使用 chess 指令开始一个棋局：

```
chess --rule <rule> [--size <size>]
```

或者直接使用已经注册号的快捷调用：“围棋”，“五子棋”，“黑白棋”，也可以开始一个棋局。

其中目前支持的棋局规则以及它们对应的规则名和默认棋盘大小为：

| 快捷名 | 规则名 | 默认大小 |
|:-:|:-:|:-:|
| 围棋 | go | 19 |
| 五子棋 | gomoku | 15 |
| 黑白棋 / 奥赛罗 | othello | 8 |

使用 `chess --stop` 或者 `停止下棋` 可以停止一个正在进行的棋局。

## 落子，悔棋和跳过

当棋局开始时，默认发起人是后手，而第一个响应这个棋局者是先手。输入 `chess position` 或者 `落子 position` 就可以加入这个棋局，此时棋局正式形成，其他人无法继续加入游戏。而参与游戏的两人可以依次使用“落子”指令进行游戏。

输入 `chess --repent` 或者 `悔棋` 进行悔棋，游戏会向前倒退一步。

输入 `chess --skip` 或者 `跳过回合` 可以跳过一个回合。

输入 `chess --view` 可以查看当前棋局。
