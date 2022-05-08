---
sidebarDepth: 2
---

# 转发消息 (Forward)

@koishijs/plugin-forward 支持在不同的频道之间转发消息。它有两种使用方法：

## 无数据库模式

当没有加载数据库服务时，你需要手动提供转发规则数组。

```yaml title=koishi.yml
plugins:
  forward:
    # 请使用 {platform}:{channelId} 的格式
    - source: onebot:123456789
      target: discord:987654321
      selfId: '33557799'
```

当用户 Alice 在频道 `source` 中发送消息 foo 的时候，`selfId` 对应的机器人就会在频道 `target` 中发送如下的内容。接着，频道 `target` 中的用户 Bob 也可以通过引用回复这条消息的方式将自己想说的话发回到频道 `source` 中去。

<panel-view title="聊天记录">
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>Alice: foo</p>
</chat-message>
<chat-message nickname="Bob" color="#00994d">
<blockquote><p>Alice: foo</p></blockquote>
<p>bar</p>
</chat-message>
</panel-view>

## 有数据库模式

如果已经加载了数据库服务，那么上述规则列表将失效。此时插件会提供指令来管理转发规则。

| 指令语法 | 简写形式 | 功能描述 |
| -------- | -------- | -------- |
| `forward add <channel>` | `fwd add` | 添加目标频道 |
| `forward remove <channel>` | `fwd rm` | 移除目标频道 |
| `forward clear` | `fwd clear` | 移除全部目标频道 |
| `forward list` | `fwd ls` | 查看目标频道列表 |

::: warning
上述 `<channel>` 的语法是 `#{platform}:{channelId}`，前置的 `#` 字符不可忽略，请注意与配置项的不同。
:::
